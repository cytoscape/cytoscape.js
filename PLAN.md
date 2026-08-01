# WebGPU model + renderer prototype (#3486)

**Status: implemented and evolving** on the `v4` branch (started as
`feature/webgpu`).  The base pass (11 commits, `e30542cf4..9b177c193`)
landed first — including SDF node labels, pulled into scope so labelled
rendering could be assessed for performance — and subsequent rounds
(follow-ups, API gap closure, the selector removal, mappers, animation,
image export, label testability, the round-10 parity sprint, round-11
slot-stable compaction, edge-label autorotate) are recorded below as
"Landed (round N)" sections, each verified green when it landed; the
round-12 curved-edges plan has both flagged calls signed off, pass
12a (bundled bezier + self-loops) landed 2026-07-30, and pass 12b
(unbundled bezier + segments + taxi) landed 2026-07-30/31, and pass
12c (endpoints + haystack/straight-triangle) landed 2026-07-30/31 —
**round 12 is complete**; the round-13 style-prop parity plan
(2026-07-30, at the end of this file) landed in full on 2026-07-31 —
**round 13 is complete** (12c → A1–A2 → B1–B7 → C1–C3 → D1–D4, every
item with Node specs plus a golden and/or a live v3 pixel-parity
scene); the round-14 compound-nodes plan (2026-07-31, at the end of
this file) landed in full the same day — **round 14 is complete**
(14.0 docs-first → 14.1–14.8 model/CPU → 14.9–14.11 renderer/
interaction → 14.12 benchmarks, every item tests-first with Node
specs, and the renderer items with goldens + live v3 pixel-parity
scenes).  A 2026-08-01 design sitting **dropped z-index outright**
(decided design) and scoped rounds 15–18 — background images,
multiline labels + label bb, the event vocabulary + extension
contract, and the GPU force layout — and all four rounds **landed in
full the same day** (plans + per-item records at the end of this
file; every item tests-first, 2142 Node + 60 module tests and
138 Playwright specs green at the close).  **Round 19** (2026-08-01)
landed slot-moving compaction — the last open architecture item —
and **round 20** (2026-08-01, the plan at the end of this file)
closed gap item 8: the interaction tuning options
(`wheelSensitivity`, the tap-threshold pair, `tapholdDuration`), the
`events`/`text-events` pointer-transparency props, and the
two-finger-cxt + three-finger-box touch gestures (2190 Node tests
and 147 Playwright specs green at the close).  `src/gpu/README.md` is
the maintained scope / deviations doc; this file records each round's
plan and outcome.

## Process (applies to all work under this plan)

- **Isolated commits as you go.**  Every item lands as its own
  commit(s) with a detailed message — never batch unrelated changes,
  and never leave a round's work sitting uncommitted.
- **Docs travel with the code, every commit.**  Each commit updates
  `src/gpu/README.md` (scope / deviations / design decisions) and this
  file — including the logbook: the round records ("Landed (round N)"
  sections and their verification notes) are written or amended in the
  same commit as the work they describe, not batched at the end.
- **A closing docs sweep ends every round** (rule added 2026-08-01,
  after the post-round-19 sweep caught drift the per-commit rule had
  missed).  Per-commit doc updates track the sections a change
  obviously owns; the long-lived overview sections — the directory
  layout, the follow-up/open-hooks lists, the README header and
  "Follow-up hooks", cross-references like "still open"/"remains" —
  belong to no single commit and drift silently.  So once a round's
  last item lands, sweep both docs end to end before calling the
  round complete: grep for the round's own vocabulary and for
  staleness markers ("open", "remains", "planned", "not yet", stale
  counts and file lists), verify every section the round touched
  reads true, and land the fixes as the round's closing docs commit.

## Context

Issue #3486 specs a v4 performance redesign: columnar/GPU-native model, persistent GPU buffers, WebGPU rendering. This first pass (originally on `feature/webgpu`, branched from the TS refactor PR #3477; the work now lives on `v4`) builds a **separate v4-style prototype** — not a mode of the canvas renderer like WebGL. It ships a new GPU-oriented data layer with the familiar synchronous core/element API on top, plus a WebGPU render pipeline. The existing v3 core, collection, and renderers are **not modified**.

Agreed constraints (from user) — the **pass-1 agreement**, kept as the historical baseline: nearly every "No" below has since landed in rounds 6–19 (animations, the sheet + mapper styles, layouts, algorithms, compound nodes, `data()`, arrows, curved edges, ...); the sections and round records below track what actually shipped.
- **CPU-canonical columnar model**, write-through to persistent GPU buffers via dirty-range uploads. Sync API reads always hit CPU typed-array columns. Model works headless (Node-testable, no GPU). ✅
- **Parallel core** in a new directory with its own entry point; familiar API shapes. ✅
- **API scope**: core — viewport fns, events, graph manip, grid layout only. Collections — events, graph manip, position/dims, iteration, comparison, building/filtering, basic traversal (outgoers etc.), select/unselect. **No**: animations, stylesheets (constrained compiled-style blocks instead, constants only, no mappers), other layouts, algorithms, compound nodes, `data()` (deferred; ids/source/target are first-class). ✅ — with one deliberate scope addition: the `label` style prop accepts the single mapper `data(id)`, since ids are first-class.
- **Rendering scope**: SDF node shapes, straight edges (endpoints read from node position buffer on-GPU), GPU picking, basic culling/LOD. Originally **no labels or arrows**; **SDF labels were added** in the follow-up commits (see below). Arrows remain out. ✅
- **Hard error** when WebGPU unavailable (only when a container is given; headless never throws). ✅

## Directory layout (as built)

```
src/gpu/
  index.mts              # default factory cytoscapeGpu(options); hard-error gate; wires model↔renderer↔pointer
  gpu-types.mts          # public option/type surface (GpuRendererOptions LOD knobs, RendererStats, ...)
  core.mts               # GpuCore facade: graph manipulation, queries, events, style(), layout(), pick(),
                         #   batching, compact() (round 19), json()/serialize(), destroy(), width/height
  collection.mts         # GpuCollection ("element is a length-1 collection", v3-style; interned handles;
                         #   epoch-guarded _refs with post-compaction lazy repair, round 19.3)
  viewport.mts           # zoom/pan/panBy/fit/center/extent state + math (core-owned; core emits the events)
  events.mts             # single core Emitter (reuse src/emitter.mts) with ref/predicate-qualified listeners
  matcher.mts            # query objects compiled to per-group (mask, want) flag tests + data conditions
  style.mts              # StyleEngine: sheet blocks compiled into channel columns + label sidecar
  style-scales.mts       # mapper DSL: object specs compiled to a closure-free IR + CPU evaluator
  style-schemes.mts      # named color schemes (viridis, ColorBrewer, ...) + sRGB↔OKLab
  easing.mts             # compileEasing: one curve layer shared by the CPU tick and the GPU kernels
  curve-geometry.mts     # CPU twin of the curve WGSL (rounds 12a-c): frames, routes, corners, bounds
  columnar.mts           # the columnar elements form: validation + toColumnarElements converter
  wire.mts               # the binary wire format: serializeElements/deserializeElements + cy.serialize()
  element-defs.mts       # classic definition-form parsing shared by the factory and cy.add()
  image-registry.mts     # round 15: the unique-image pool (url dedup, tiers, async decode)
  label-wrap.mts         # round 16: multiline breaker/justify/ellipsis + the headless estimator
  animation.mts          # Animation + AnimationManager: CPU tween + queues; routes position/paint to the GPU sink
  layout/                # grid, preset, circle, concentric, breadthfirst, random
    contract.mts         #   round 17: the extension contract (CustomLayout + the columnar LayoutContext)
    force-sim.mts        #   round 18: the CPU reference force simulation (the kernels' spec)
    force.mts            #   round 18: the built-in force layout (contract consumer; picks the executor)
  algorithms/            # round 10: the full v3 algorithm surface, slot-native over CSR
  shape-points.mts       # round 10: unit polygon + arrowhead point tables shared by WGSL gen + CPU pick
  store/
    graph-store.mts      # GraphStore: tables + indexes + sidecars; mutation API; compact() (round 19)
    table.mts            # ColumnTable: typed-array columns, x2 growth, free-list, generations, compact()
    id-map.mts           # string id ⇄ slot dictionary, blob-native (UTF-8 blob + probe table; round 11 reclaim)
    adjacency.mts        # CSR adjacency (two counting passes) + per-node overlay for incremental adds
    hierarchy.mts        # round 14: compound parent links, depth, child lists, the parent draw permutation
    curve-index.mts      # rounds 12a-c: bundle/loop membership + curve-param derivation
    curve-blob.mts       # variable-length record pools (curve params, polygons, images) + waste reclaim
    data-store.mts       # the data() sidecar: per-(group, key) adaptive columns, dict reclaim
    dirty.mts            # DirtyTracker: per-column coalesced [min,end) span, resized flag, touch() for sidecars
  contract.mts           # model↔renderer contract: ColumnId specs, flag bits, ModelView, StoreDelta, LabelEntry
  gpu-context.mts        # adapter/device/canvas configure, device-lost handling
  render/
    renderer.mts         # frame graph: rAF render-on-dirty loop, pass ordering, stats(), pick/export driving
    column-mirror.mts    # GPU storage-buffer mirror; dirty-span writeBuffer; realloc+full re-upload on resized
    cull.mts             # compute cull pre-pass: three-dispatch stream compaction + indirect args per group
    node-pipeline.mts    # node render + depth-prepass pipelines (SDF shapes, vertex pulling)
    edge-pipeline.mts    # straight-edge pipeline (endpoints fetched from the node position buffer)
    curved-edge-pipeline.mts   # rounds 12a/b: the curved stream (24-quad strips off the params + blob)
    arrow-pipeline.mts   # straight-end arrowheads (SDF point tables, boundary tips)
    curved-arrow-pipeline.mts  # curved-end arrowheads (end tangents off the route)
    label-pipeline.mts   # SDF label pipeline (glyph instances; draws after nodes; not pickable)
    label-layer.mts      # consumes the label-dirty channel; shaping memo; lays glyphs into the GlyphBuffers
    label-layout.mts     # pure glyph layout (Node-testable)
    glyph-atlas.mts      # runtime SDF atlas: canvas-2D raster → exact EDT → shelf-packed r8 texture
    glyph-buffer.mts     # persistent glyph-instance buffers: per-owner ranges, tombstones, compaction
    mapper-runtime.mts   # GPU mapper eval: program/stop/data packing + the per-frame runtime
    mapper-shaders.mts   # the eval kernel WGSL (scale math mirrors style-scales.mts)
    gpu-tween.mts        # GPU tween runtime + kernels (position/scalar/color; per-slot from/to)
    gpu-force.mts        # round 18: the on-device force integrator (grid/gather/apply + lease)
    image-arrays.mts     # round 15: tiered rgba arrays + mips + the r8 icon array + image table
    image-pipeline.mts   # round 15: the image compositing draw (own pass off the node streams)
    image-decoder.mts    # round 15: the browser rasterizer (fetch/createImageBitmap/svg canvas)
    cpu-pick.mts         # synchronous CPU node pick: shader-semantics replica over the columns
    picking.mts          # r32uint pick tile, 3-buffer staging ring, latest-wins + full-ring deferral
    gpu-timer.mts        # timestamp-query wrapper behind stats().gpuFrameMs
    scale-controller.mts # adaptive render scale: GPU-time-driven band controller
    upscale.mts          # Catmull-Rom bicubic upscale pass for scaled frames
    quad-index.mts       # shared indexed-quad index buffer
    shaders.mts          # all WGSL as template-literal strings
    webgpu-constants.mts # numeric usage/stage flags so render modules stay Node-importable
  interact/pointer.mts   # pointer/wheel/touch: pan, zoom, hover, taps, box select, drag, pinch, cxt
  README.md              # scope + accepted deviations (the maintained doc)
debug/webgpu/            # dev harness: network/bg/LOD/labels URL params, ?gen=NxM generator, stats overlay
playwright-page/webgpu.html (+ parity.html for the live v3-vs-v4 diffs)
playwright-tests/webgpu.spec.js (+ webgpu-visual.spec.js + goldens/)
test/gpu-*.mjs           # 100+ Node-runner suites (auto-picked-up by the test:js glob)
benchmark/gpu/           # mitata suites + the renderer/report runners (see the Benchmarks section of the README)
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
- **Picking**: r32uint id target, same draw order, ids 0/slot+1/high-bit-edge; latest-wins requests through a ring of 3 staging buffers (a full ring defers the pending request to the next frame with a free slot — drop-to-null was removed by the 2026-08-01 pick-ring look at the end of this file). Exposed as `cy.pick(x, y)`. Reworked after the initial pass (the original full-scene pick pass + unbounded frame queueing made hover picks take ~1 s on GPU-bound graphs): the pick pass now draws a fixed 64×64 cursor-centered tile — a pick-specific Frame uniform whose viewport is the tile turns the shaders' own conservative culling into cursor-region culling, O(region) not O(scene) — submits in its own command buffer ahead of scene work, reads back a single center texel, and pick-only frames skip the scene pass entirely. Scene submissions are capped at 2 in flight (backpressure; a behind GPU coalesces state into the next frame instead of queueing deeper). Result at 100k×300k: hover-while-panning pick latency ~956 ms → ~70 ms median, idle picks ~58 ms → ~13 ms.
- **Culling/LOD**: originally VS conservative collapse; now a **compute cull pre-pass + drawIndexedIndirect** per group (nodes, edges, glyphs) — a deterministic three-dispatch stream compaction (count / serial scan / scatter with a workgroup Hillis-Steele scan) that preserves slot order, with an exact Liang-Barsky segment-vs-rect test for edges; the pick pass reuses the kernels with the pick-tile uniform (O(region) picks). LOD: edge width floor with alpha compensation; **far-zoom edge decimation** (below half alpha, a hash-stable 1-in-N subset at N× alpha, N ≤ 64); plain-disc nodes below ~3 px; sub-pixel size flooring with alpha compensation; optional zoom-based edge dimming. Indexed instance quads (4 VS invocations per quad via vertex reuse). Node decoration columns moved to the fragment stage (flat-instance fetch) to stay within per-stage storage-buffer limits. ndex-x-large pan benchmarks (GPU ms/frame): far zoom 33 → 3.5; zoomed-in 20× at dpr 1 12.4 → 8.8; fit-all at dpr 1 18.5 → 10.2; labels at 117k glyphs now ~free (38.6 vs 37.7 ms at dpr 2 fit-all).
- **Labels (added)**: runtime SDF glyph atlas (TinySDF-style canvas raster → exact Euclidean distance transform → one shelf-packed 1024² r8 texture, glyphs added lazily; edge encoded at sample 0.5, fwidth-AA in the FS). Persistent glyph-instance buffer (40 B/glyph) with per-node ranges, tombstones + compaction, coalesced span uploads and ColumnMirror realloc rules. Glyph instances reference the **node slot**, so labels follow drags/layouts on-GPU with zero rebuild (a node move uploads 8 bytes). Labels fade out below `labelFadePx`; single-line, centered below the node, not pickable.
- **Interaction**: wheel zoom-about-cursor, drag pan, throttled latest-wins hover picking (HOVERED bit + mouseover/mouseout), pan-vs-grab via an exact synchronous CPU node pick (no staleness), node drag through the core position API, tap-toggle selection (shift additive, background clears). Hover picking pauses during viewport-only gestures (pan drags never pick; wheel zooms suppress picks and re-pick once settled). Pinch deferred.
- **Pick fast paths (added)**: nodes pick synchronously on the CPU (columnar scan replicating shader semantics — flooring, plain-disc LOD, shape tests, topmost wins; unit-tested); the GPU tile (now edges-only) reads back whole and doubles as a cursor-region pick cache invalidated on viewport/geometry changes. ndex-x-large at dpr 2: node hover ~0 ms, cold edge/background ~7 ms, cached ~0.2 ms, hover-while-panning median ~0 ms (was ~70 ms), with zero GPU pick passes for node hovers and cache hits.
- **Frame timing**: `stats()` reports `cpuFrameMs` (encode/submit cost, ~0.1 ms by design) separately from `gpuFrameMs` (real frame GPU time via the optional `timestamp-query` feature — the span across the cull/render/upscale passes, which is robust to backends that emulate pass-boundary timestamps at command-buffer granularity) — CPU-side timers cannot see GPU execution, which is what bounds fps on large graphs.
- **Adaptive render scale (added)**: `renderScaleMin`/`renderScaleMax` band (defaults 0.5/1), quarter steps driven by median `gpuFrameMs` over ~400 ms windows (drop > 14 ms; raise only when the projected cost at the higher step fits under 10 ms — no pumping; backpressure stalls as the no-timestamp fallback; pure `ScaleController`, unit-tested). Idle settles back to max after ~250 ms so stills are always native — chosen over a static scale because far zoom is maximally resolution-sensitive (floors are render-px-defined, sub-pixel statistics change, decimation engages earlier) yet nearly free at native after decimation+culling. Scaled frames render offscreen + Catmull-Rom bicubic upscale (9 bilinear taps). Verified: fit-all pan at dpr 2 steps 1 → 0.75 → 0.5 within ~0.8 s (25 → 76 fps, 8.3 ms GPU); idle returns to 1; far-zoom pan holds 1. Picking stays native; `labelMinPx` option hard-culls unreadably small labels in the glyph cull predicate.

- **Whole-graph fit fast path (added)**: no-arg `fit()`/`center()` compute bounds via `GraphStore.boundingBox()` — a direct columnar scan (nodes: position ± size/2 + border/2; edges as a first-class extent term, today the endpoint centers) instead of materializing ~500k element handles through `cy.elements()`. ndex-x-large: 235 → 15 ms, identical zoom/pan. Future edge geometry (bezier, arrows) extends the edge term in the store scan and `GpuCollection.boundingBox` together.  (Since superseded: round 12a extended the store scan's edge term with the conservative curve-hull bound and gave `GpuCollection.boundingBox` the exact lazy curve tier.)

## Integration — done

- devDep `@webgpu/types`; tsconfig `"types": ["@webgpu/types"]`.
- rolldown: `build/cytoscape-gpu.umd.js` (global `cytoscapeGpu`) + `build/cytoscape-gpu.esm.mjs`; the `FILE=umd` watch filter picks the gpu UMD up automatically (verified).
- package.json: `exports["./gpu"]`, gpu bundles in `dist:copy`, `debug/webgpu` in `watch:sync`.
- `debug/webgpu/`: network/bg/LOD/labels URL params, `?gen=NxM` random-graph generator, best-effort constant-prop conversion of the v3 fixture styles, FPS/counts/upload-bytes/glyphs/pick-latency overlay.
- playwright: `webgpu` project — `channel: 'chromium'` new headless + `--enable-unsafe-webgpu --enable-unsafe-swiftshader`, loading via `http://127.0.0.1:3333`; soft-skips without an adapter; the default chromium project ignores the webgpu spec.

## Verification — all green (the pass-1 record; each later round's Landed section carries its own tallies)

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

- Element/core listener firing order is registration order *within a bubbling phase* (compound bubbling landed round 14.5 with v3's cross-phase order).
- No z-index; compound parent bodies (round 14.9, depth order) under edges under leaf nodes under labels; within a stream, slot order (reused slots draw at the recycled position).
- Float32 position precision (~7 significant digits).
- Pan-vs-grab uses the ≤2-frame-stale resolved pick.
- `cy.elements()` returns nodes then edges, not mixed insertion order.
- Labels: nodes only, single-line, fixed below-node placement, not pickable, fixed-size atlas, color/text baked per glyph run.  (Since superseded: edge labels + label visuals landed in round 10; edge-label autorotate 2026-07-29.)
- `data()`, arrows, compounds, bezier, non-grid layouts: all since landed (animations round 9; circle/concentric/breadthfirst/random layouts round 10; the full curved-edge families rounds 12a–12c; **compound nodes round 14**; GPU layouts stay logged).

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

All follow-ups are done.  The open hooks this list once tracked have
all since closed: ~~slot compaction~~ (slot-stable tier round 11;
slot-moving round 19), ~~z-index ranks~~ (z-index dropped by decided
design 2026-08-01), ~~compound nodes~~ (round 14), ~~curved edges~~
(rounds 12a/12b/12c), ~~a binary export of live graphs~~
(`cy.serialize()`, round 10), and mappers landed as the round-7
object DSL below.  "More layouts" remains demand-gated (the round-17
extension contract is the vehicle).

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
  ~~`sortByZIndex`/`zDepth`~~ (closed 2026-08-01: z-index is dropped
  by decided design — see the design-sitting section below),
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
  labels, bundled bezier — v4-but-not-yet; since superseded for bundled
  bezier + self-loops, which landed round 12a under exactly this model).  These are expensive *and* read
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

- ~~**Compounds**~~: `parent`/`parents`/`children`/`descendants`/
  `commonAncestors`/`siblings`/`orphans`/`nonorphans`/`isParent`/
  `isChild`/`isChildless`/`isOrphan`, and compound-relative
  `relativePosition`/`padding`/bounds — **landed in round 14**.
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
  membership as a structural index.  (Since superseded: bundled bezier +
  self-loops landed round 12a exactly in this tier, incl.
  `controlPoints`/`isBundledBezier`; `segmentPoints` and the
  unbundled/segments/taxi families landed in pass 12b, same tier.)
- **Full stylesheet + mappers** beyond the constant blocks and the label
  `data(key)` mapper; layouts beyond grid/preset.  (Since superseded:
  mappers landed round 7–8; circle/concentric/breadthfirst/random
  layouts landed round 10.)

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

## Logged direction — edge labels (built in round 10 B5, exactly this shape)

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
rules — is a separate follow-up call (since landed 2026-07-29).  Sequencing: after 9.7, so the
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

**Round complete (2026-07-27): all 17 items landed**, each as isolated
commits with docs in-commit and the full verification gate per item.
Net across the round: 1461 → 1629 Node tests, 33 → 44 `webgpu` + 7 → 14
`webgpu-visual` Playwright specs (51 total), 7 new golden scenes, and
the full v3 algorithm surface, four more layouts, viewport animation
targets, data query predicates, ten node shapes, line styles, label
visuals, arrow shapes, edge labels, the gesture set, mount/unmount and
device-loss recovery in v4.

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
- [x] **A4 Algorithms: clustering** — landed 2026-07-27.  `kMeans`,
  `kMedoids`, `fuzzyCMeans`/`fcm`, `hierarchicalClustering`/`hca`
  (threshold + dendrogram modes, `addDendrogram`), `markovClustering`/
  `mcl` (Float64Array matrices), `affinityPropagation`/`ap`, plus the
  shared `clustering-distances` metric module.  The attribute-space
  algorithms stay handle-level like v3 (they're feature-space, not
  adjacency walks); markov builds its matrix off the slot view.  v3
  quirks preserved: raw-option validation for affinity (damping and
  preference effectively required), the 2-arg custom distance form
  when no attributes are given, kMedoids' k>n throw.  25 specs pin the
  v3 fixtures' numeric expectations (k-means/k-medoids/fcm/markov
  cluster memberships in exact order, dendrogram levels 0–10);
  affinity gets a compact deterministic fixture instead of v3's
  700-line one.  `test/gpu-algorithms-clustering.mjs` (1556 Node tests
  green).
- [x] **A5 Algorithm benchmark** — landed 2026-07-27.
  `benchmark/gpu/algorithms.mjs` (standalone Mitata sweep; superlinear
  ops gate on BENCH_N).  At N=2000 (4k edges) the slot-native walks win
  every op vs v3: bfs 34×, dfs 39×, dijkstra+pathTo 33×, bellmanFord
  22×, kruskal 14×, tarjan SCC 19×, hopcroft-tarjan 20×, betweenness
  13×, degreeCentralityNormalized 22×, closenessCentrality 31×, aStar
  2.1×, hierholzer 2–3×.  The dense-matrix ops are parity, as expected
  (identical math dominates): pageRank/floydWarshall/markov/
  hierarchical/kMeans all within ±1.2× at N=500.
- [x] **A6 Layouts** — landed 2026-07-27.  `circle`, `concentric`,
  `breadthfirst`, `random` (handle-level ports of the v3 math — these
  layouts are per-node-callback-shaped, unlike grid's slot path), plus
  the v3 plumbing on the collection: `layoutDimensions`,
  `layoutPositions` (spacingFactor scaling, `transform`, fit/zoom/pan,
  the layoutstart/ready/stop event flow, and `animate: true` via the
  existing animation system — handle-memoized, `animateFilter`
  honored; the fit applies at layoutstop until A7's animated fit), and
  `eles.layout()`/`makeLayout`/`createLayout` (grid and preset honor
  `eles` scoping too, incl. fit-to-eles).  Two corrections vs the
  repo's v3 files, both noted in code: circle calls layoutPositions on
  the *sorted* collection (upstream v3 behavior — the repo's TS port
  calls it on the unsorted one, so `sort` does nothing there), and
  breadthfirst compacts the nulls left by maximal shifts before
  sorting a depth (v3 passes them into its comparator).  28 specs in
  `test/gpu-layouts.mjs` (1584 Node tests green).
- [x] **A7 Viewport animation targets** — landed 2026-07-27.
  `cy.animate`/`cy.animation` (the handle form is new, mirroring
  `eles.animation`) take `fit: { eles | boundingBox, padding }` and
  `center: { eles }`, resolved to concrete pan/zoom at creation time
  (v3 semantics — pinned by a spec that moves a node after creating
  the animation); fit/center bypass the pan/zoom gating flags, like
  `fit()` itself.  `eles.boundingBoxAt(posOrFn)` landed with it
  (side-effect-free direct computation, edges spanning out-of-
  collection endpoints at current positions) — pulled forward from A9
  because the animated layout fit needs it: `layoutPositions` with
  `animate: true` now animates the viewport to the final arrangement's
  box concurrently with the node tweens, exactly v3's shape (the A6
  fit-at-layoutstop compromise is gone).  Note: v3's animated
  `fit()`/`center()` *options* don't exist in v3 either — the target
  form is the parity surface.  9 specs in
  `test/gpu-viewport-animation.mjs` (1593 Node tests green).
- [x] **A8 Data query predicates** — landed 2026-07-27.  `GpuQuery`
  gains `data: { key: value | { eq/ne/lt/lte/gt/gte/in } }` (bare
  value = `eq`; keys AND together), compiled to `CompiledCondition[]`
  on the plan and evaluated with the *same* `testCondition` the `case`
  mapper uses (missing value fails every op, `ne` included; exactly
  one op per condition; `in` non-empty; ordinal ops numeric — all
  throwing as the mapper does).  The whole-graph scan
  (`scanRefsInto`) takes the tests with per-key column readers hoisted
  out of the loop (`DataStore.reader`); the collection-filter and
  `planMatchesRef` paths apply them too.  10 specs in
  `test/gpu-query-data.mjs` (1603 Node tests green).
- [x] **A9 Small items** — landed 2026-07-27.  (`boundingBoxAt` landed
  with A7.)  `padding()`/`paddedWidth`/`paddedHeight`: accessor-only —
  v4 has no `padding` style prop (compounds-era), so padding reads 0
  and padded dims equal plain dims; kept so v3 call sites work.
  **`cy.serialize()`**: live-graph export to the wire ArrayBuffer
  (ids, positions, selected/selectable flags, and the data() sidecar
  via `DataStore.exportColumns` — numbers as f64+NaN holes, strings as
  dictionary columns, mixed as arrays), round-tripping through
  `options.elements`/`cy.add()`; 7 Node specs incl. selection state,
  post-load mutations and empty graphs.  **Web-font re-raster hook**:
  the renderer listens for `document.fonts`'s `loadingdone` and
  re-rasters the atlas + rebuilds all glyph runs (`GlyphAtlas.
  reraster`, `store.markAllLabelsDirty`), closing 9.7's
  cached-fallback-glyph footgun; removed on destroy.  Playwright spec
  registers a FontFace *after* the label renders and pins the pixel
  change (an @font-face family can't test this — the atlas's own
  canvas use starts its load).  Verified: 1610 Node + 47 module tests,
  34 webgpu + 7 webgpu-visual Playwright specs on a fresh bundle
  (note: a stale http-server on :3333 silently serves an old bundle to
  Playwright — kill it before trusting a run).

**Phase B — renderer/shader work, golden-verified**

- [x] **B1 Node shape parity** — landed 2026-07-27.  Ten polygon
  shapes (`triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`,
  `diamond`, `rhomboid`, `vee`, `star`, `tag`, + `square` alias) from
  **one point-table source of truth** (`shape-points.mts`, built with
  the same shared math generators v3's node-shapes registration uses —
  identical geometry).  Shape ids 4–13 in `contract.mts`; WGSL
  per-shape SDF functions are *generated* from the tables (iq's
  sdPolygon, vertices scaled by half-size so the device-space distance
  is exact — first cut evaluated in normalized space and showed
  smeared borders on stretched nodes in the golden; exact-space fixed
  it); CPU pick uses exact point-in-polygon in normalized space
  (inside-ness is affine-invariant); the depth prepass treats polygon
  interiors via their SDF (conservative rect/roundrect/ellipse
  fast paths kept).  `round-*` polygon variants deliberately not
  ported (no clean closed form under anisotropic scale) along with
  cut-rectangle/barrel/etc — README records the list.  Verified: 5
  polygon CPU-pick specs (incl. concave star/vee and an anisotropic
  hexagon), keyword parse+readback specs, and a `polygon-shapes`
  golden (11 nodes incl. a selected star's accent ring and a stretched
  hexagon), stable across repeat runs; 1617 Node + 47 module tests,
  42 Playwright specs green.
- [x] **B2 `line-style: solid | dashed | dotted`** — landed
  2026-07-27.  New `edge.lineStyle` column (contract LINE_* ids) with
  the full style plumbing (keyword parse, case mappers, stored-truth
  readback); the edge VS emits a model-px longitudinal varying and a
  flat style id, and the FS applies an AA'd dash mask (v3's patterns:
  dashed [6, 3], dotted [1, 1], model units so dashes zoom with
  content).  Picking ignores gaps as v3 does; the pick FS is
  untouched.  `border-style` skipped per the plan's stretch clause
  (dashing an SDF boundary needs perimeter parameterization) — README
  records it.  `line-styles` golden (three styles + a wide diagonal
  dashed edge proving the pattern runs along the edge); 1618 Node +
  47 module tests, 43 Playwright specs green.
- [x] **B3 Label visuals** — landed 2026-07-27.  `text-outline-width`/
  `-color`/`-opacity` (second SDF threshold in the label FS; width
  precomputed CPU-side into SDF sample units), `text-background-color`
  /`-opacity`/`-padding` (a solid quad instance preceding the run's
  glyphs — a negative-u0 sentinel skips the atlas sample; it carries
  the glyph block's height so LOD fade/cull match the text exactly),
  `text-margin-x/y` (margin-y folds into the anchor; both kept in the
  entry for readback).  All eight props are **mapper-capable** (added
  to the MAPPABLE table; `applyMapped` writes whole elements so the
  label sidecar rebuilds through the existing path).  Glyph instances
  grew 40 → 48 bytes (outline color + width).  Two WGSL
  uniform-control-flow traps hit and fixed: `textureSample` and
  `fwidth` both hoisted above the solid-quad branch (caught by the
  validation-error guard).  `label-visuals` golden (outline, boxed,
  margin-shifted) at the label tolerance tier; 1619 Node + 47 module
  tests, 44 Playwright specs green.
- [x] **B4 Arrow shape parity** — landed 2026-07-27.  `vee`,
  `chevron`, `circle`, `square`, `diamond`, `tee` (+ the `arrow`
  alias), with WGSL SDFs generated from v3's arrow point tables
  (shared `ARROW_POINTS` in shape-points.mts; tip-at-origin frame,
  uniform scale — v4's arrow sizing turns out to be exactly uniform:
  halfBase/0.15 == arrowLen/0.3).  The arrow FS now evaluates a
  shape SDF in the arrow-local frame instead of the triangle's
  lateral-taper mask (the triangle's geometry is unchanged, only its
  AA method — nodes-edges-arrows golden regenerated); shape ids pack
  source|target<<8 into a new `edge.arrowShapes` column bound
  **fragment-only**, keeping the arrow VS at its 8-storage-buffer
  budget.  Readback keeps the stored-truth rule (transparent arrow →
  shape 'none'), now returning the real keyword otherwise.  Compound
  shapes not ported (README lists them).  `arrow-shapes` golden (7
  target shapes + a source-end chevron pinning the byte order);
  1621 Node + 47 module tests, 45 Playwright specs green.
- [x] **B5 Edge labels pass 1** — landed 2026-07-27, exactly the
  logged shape.  Model: the label sidecar, label-dirty channel and
  `setLabel`/`labelAt`/`takeLabelDirty` are **group-keyed** (trailing
  group param defaulting to 'nodes', so node call sites read
  unchanged); StyleEngine's label channels — the passthrough `label`,
  `font-size`, `color` and all the B3 text visuals — now compile for
  edges too (the edge write path calls the shared `writeLabel`, edges
  centering on the midpoint by font size).  Renderer: a second
  GlyphBuffer in the LabelLayer, an `edgeGlyph` cull kind (predicate =
  edge SHOWN + both endpoints SHOWN + fade/min-height + viewport at
  the midpoint), and the label shader generated for both streams from
  one template — the edge variant binds `edge.endpoints` and computes
  the **midpoint anchor in the VS**, so edge labels follow drags/
  layouts/position tweens on-GPU with zero rebuild (spec-pinned: an
  endpoint move re-uploads ≤64 B and the label lands at the new
  midpoint).  Also fixed en route: a hardcoded 40-byte glyph stride in
  the renderer's cull-capacity math (stale since B3's 48-byte
  instances; benign over-allocation) now uses GLYPH_BYTES.  Horizontal
  only — autorotate stayed the separate follow-up (since landed
  2026-07-29; see the autorotate entry below).  7 model specs
  (`test/gpu-edge-labels.mjs`), the follows-drag webgpu spec, and an
  `edge-labels` golden (midpoint + background box on a diagonal edge);
  1628 Node + 47 module tests, 47 Playwright specs green (twice).

**Phase C — interaction & lifecycle, Playwright-verified**

- [x] **C1 Gesture parity** — landed 2026-07-27.  Right button:
  `cxttapstart`/`cxtdrag`/`cxttapend` + `cxttap` (no-move), with the
  canvas context menu suppressed; `taphold` after a 500 ms unmoved
  press; `dbltap` on a same-target second tap within
  `cy.multiClickDebounceTime()` (default 250 ms; new ctor option +
  validated getter/setter) plus the debounced `onetap`; and
  drag-all-selected — grabbing a selected node collects every
  draggable selected node into a drag set moved by one bulk `shift`
  per pointermove (all flagged grabbed, unflagged on release/cancel).
  Verified by two Playwright specs (the event-order cxttap/dbltap/
  taphold sweep and a three-node drag-set spec) + a Node accessor
  spec; 1629 Node + 47 module tests, 49 Playwright specs green
  (serial run; parallel runs on this loaded machine flake one
  arbitrary visual spec — an env issue, not a code one).
- [x] **C2 `mount`/`unmount`** — landed 2026-07-27.  The factory's
  renderer+pointer wiring moved into a reusable `_attachFn` on the
  core (with the WebGPU-availability check at attach time);
  `unmount()` destroys pointer + renderer and the instance reads
  headless with a resolved `ready`; `mount(container)` re-attaches a
  fresh renderer — the new ColumnMirror's from-zero realloc re-uploads
  every column, and `markAllLabelsDirty()` requeues every glyph run
  (the old LabelLayer had consumed the dirty channel).  Same-container
  re-mount no-ops; a different container unmounts first;
  `cy.destroy()` now also tears the pointer down.  Playwright spec:
  render → unmount (headless, canvas removed, png rejects) → move/
  relabel/add while headless → mount → the moved node, its rebuilt
  label, and the headless-added node all render.  1629 Node + 47
  module tests, 50 Playwright specs green (serial).
- [x] **C3 Device-loss recovery** — landed 2026-07-27, with the
  proposed policy recorded as the decision: an external loss emits
  `devicelost` and auto-recovers **once per loss** by re-mounting a
  fresh renderer against the same container via C2's machinery (the
  model is CPU-canonical, so mirrors/pipelines/glyph runs all
  rebuild), then emits `devicerestored`; a loss during recovery or a
  failed re-acquisition goes headless-dead + `error` (the previous
  behavior).  Plumbing: `gpu-context` now surfaces *every* loss and
  the renderer distinguishes its own teardown by its `destroyed` flag
  (so `renderer.destroy()` stays silent); a `_debugLoseDevice()` test
  hook destroys the device externally.  Playwright spec: lose the
  device → `devicelost` → `devicerestored` → post-loss writes render.
  1629 Node + 47 module tests, 51 Playwright specs green (serial).

Deferred out of this round (logged, not built): compaction (below;
the slot-stable tier since landed as round 11, the slot-moving tier
as round 19); autorotated edge
labels (since landed 2026-07-29); multiline labels (since landed,
round 16); bezier edges
(round-12 plan written; passes 12a/12b/12c since landed — round 12
is complete);
compounds (since landed, round 14);
z-index (since dropped by decided design, 2026-08-01); GPU layouts
(since landed, round 18); size tweens (the R8.5 geometry seam);
`renderTo`;
restore/clone/json-import (closed — not in v4); the three-finger touch
box gesture (since landed, round 20.5).

## Landed (renderer benchmarks, 2026-07-28)

The renderer's recorded numbers (fps tables, pan ms/frame, pick latency,
init/export costs) were manual debug-harness measurements; this makes
them a repeatable command.  `npm run benchmark:gpu:renderer` (or
`benchmark:gpu:report -- --renderer` to fold into the combined report)
runs `benchmark/gpu/render-bench.mjs`: a Playwright-library driver (not a
test project — no assertions, not in CI's sweep) that serves the repo on
an ephemeral port (no stale-:3333 dependence; bundle-vs-src mtimes are
checked and warned), launches Chromium `channel: 'chromium'` with
`--enable-unsafe-webgpu`, **aborts without a real adapter** (software
adapters warn — different machine class), and drives
`render-bench.html`: one instance at a time on a shared stage, seeded
25k×50k / 100k×300k generators + stripped ndex-x-large, v3 canvas vs v4
WebGPU on identical defs and constant styles.  Scenarios: continuous-pan
steady state (fit-all / zoomed-in 20× / far-zoom ÷8, labels off/on) —
programmatic `panBy` per rAF, warm-up then sampling until window + a
minimum frame count; wall ms per *rendered* frame (v4: `stats().frames`
delta, since backpressure skips ticks; v3: the tick delta, since the
canvas draw runs inside it) as the comparison metric, with
`stats().gpuFrameMs` (timestamp-query) as `gpu (device)` rows — the
vsync-unbounded cost; hover-while-panning `pick()` latency percentiles;
one-shot init / columnar init / full-png export (≤2048 px — full-graph
exports would exceed the device texture cap).  dpr 2, 1280×800, render
scale pinned to 1.  Results emit the same mitata-shaped stats
(`render-stats.mjs`, unit-tested) so `report-html.mjs` renders renderer
sections unchanged; jobs carry a `note` (new, rendered once per section)
stating the vsync bound and pinned config.  First full run (M2, Metal,
dpr 2), fit-all pan p50 v3-vs-gpu wall: 336 ms vs 10.6 ms at 25k×50k
(device 7.8 ms; far-zoom device 2.1 ms — decimation), 2.05 s vs 15.2 ms
at 100k×300k, 1.86 s vs 32.8 ms on ndex-x-large (~30 fps native,
matching the round-recorded "25 fps before adaptive scale"); init 7.7 s
vs 457 ms at 100k; ndex pick p50 0.1 ms (the CPU fast path).

## Landed (benchmark HTML report, 2026-07-28)

`npm run benchmark:gpu:report` runs the Mitata suites and renders one
self-contained HTML page (plus a timestamped results JSON) into the
gitignored `benchmark/gpu/results/`.  Pieces: `bench-run.mjs` — a shared
`finishRun()` tail that, under `BENCH_JSON`, runs quietly and captures
per-group/per-bench stats (mitata's `run()` returns them; sample arrays
stripped) with terminal behaviour otherwise unchanged; `report.mjs` — the
job-table orchestrator (quick profile at default scales; `--full` adds
the 2k/20k/200k matrix with one process per group at 200k via `BENCH_OP`,
per the suite headers; failures logged and reported, partial reports
still render; `--suite` filter, `--render-only` re-render); and
`report-html.mjs` — a pure results→HTML renderer (Node-tested in
`test/modules/gpu-benchmark-report.mjs`): times as dumbbell dots on log₁₀
axes (position, not bar length — length encodes nothing on a log axis),
a ranked speedup overview against a 1× reference line, geo-mean/best-win
stat tiles, per-suite table views, a cross-N scaling table on full runs,
light+dark styling, hover/focus tooltips, no external assets.  Decisions:
quick-by-default (full is opt-in), local gitignored artifact, Mitata
suites only — the browser-side numbers stayed manual at this point
(since superseded: the renderer benchmarks above made them a command,
folded in via `--renderer`).

## Landed (round 11 — slot-stable compaction, 2026-07-29)

The buildable tier from the compaction analysis (next section): the
append-only structures that leak under churn now meter their waste and
reclaim it automatically on a threshold, extending the policy the
insertion-order list has always used (`compactOrder` at > half stale).
No element slot moves — refs, draw order and the GPU mirrors are
untouched — which is what the analysis identified as making
auto-trigger safe for this tier; the *slot-moving* tier's policy calls
(ref survival, trigger, draw order) stay open below.  Each piece lands
as an isolated commit with Node tests.

- **En route fix**: adjacency's `overlayCount` counted +1 per
  `addEdge` but decremented per overlay-list entry (an edge holds two:
  `out[source]` + `inn[target]`), so it could hit zero with entries
  still live and let `addBulk` build a "fresh" CSR under a non-empty
  overlay, drawing bulk edges ahead of earlier incremental ones in
  per-node incident order.  It now counts entries; regression test
  pins the ordering.
- **Id blob** (`store/id-map.mts`): `remove()` meters the removed id's
  stranded UTF-8 bytes; when they exceed half the blob (≥ 4 KiB
  floor), the live ranges compact into a fresh right-sized blob, so
  peak-then-small graphs also shrink back toward the floor.  The probe
  table stores (group, slot) codes, never byte offsets, so it — and
  the per-slot hashes and decoded-name cache — survive compaction
  untouched; probe-table tombstones already self-reclaimed via the
  rehash in `ensure()`.  Cost is O(live bytes), amortized over the
  removals that stranded the waste.  A 20k add/remove churn loop that
  used to strand ~200 KB now holds the blob ≤ 8 KiB.
- **CSR adjacency** (`store/adjacency.mts`): removals strand CSR
  entries (fixed per-node segments can't refill) and post-build adds
  accumulate in the per-node overlay arrays — both metered now
  (`csrStranded`/`overlayEntries`).  When their sum exceeds half the
  live entry count (64-entry floor), `GraphStore` rebuilds CSR from
  the live edges in insertion order — the same two counting passes as
  the bulk build — folding the overlay back into the compact typed-
  array shape and dropping the stranded space.  Insertion order is
  what the incremental paths produce anyway, so per-node incident
  order is preserved across a rebuild (the one exception: an edge
  re-pointed by `moveEdge` sits at its re-add position until a rebuild
  returns it to insertion order).  A side effect closes a gap from
  round 5: a *purely incremental* graph (never bulk-loaded) used to
  keep all its edges in JS overlay arrays forever; it now folds into
  CSR once past the floor, at geometric intervals (amortized O(1) per
  add).
- **String dictionaries** (`store/data-store.mts`): dicts only grew,
  so entries whose last reference was overwritten or cleared leaked
  under churn.  String columns now keep a per-entry refcount (one
  extra indices read per write); when dead entries exceed half the
  dict (8-entry floor) the dict compacts — live entries keep their
  relative order, the indices column remaps **in place** (bound CPU
  evaluators hold the array and col by reference), and a per-column
  `epoch` bumps.  Values never change, only the private index space,
  so no mapper output moves (ordinal domains are explicit — there is
  no dict-order-derived domain).  GPU interplay: `onDictRemap` →
  `GraphStore.markDataWrite` over the whole column (watched keys
  re-upload their remapped index shadow), and the mapper runtime packs
  `dictEpochs` beside `dictSizes` — the span handler reconfigures on
  either mismatch, since a same-frame shrink-then-regrow can return
  the dict to its packed *length* with a different index mapping
  (spec-pinned: the epoch test fails on the length check alone).  The
  ingest path also compacts adopted wire dicts that arrive with
  unreferenced entries.

**Verification**: typecheck, lint, `test:js` (1638 → 1645) and
`test:modules` (58) green per commit.  Write-path cost checked against
the pre-round baseline (`benchmark/gpu/mutators.mjs` at N=2k, same
machine, same run): remove+re-add 5.45 vs 5.32 ms/iter (noise), data
set at parity — after re-splitting the DataStore write path so the
numeric case stays inlinable (the first cut regressed numeric bulk
writes ~16% by growing `write()` past the inline budget; caught by the
baseline comparison, pinned back to 50.5 vs 50.7 µs).  Churn
measurement (sliding-window store scenario: 20k nodes / ~21k edges
stable, 1k-node bands removed and re-added with fresh ids and
per-element strings): after 40 rounds the id blob holds 699 KB vs
1.84 MB pre-round, the string dictionary 21.2k entries vs 60k, and
adjacency lives in typed-array CSR (38k live entries, 41k capacity,
4k overlay) vs 42k permanent JS-array entries; at 80 rounds the
pre-round numbers keep growing linearly (3.03 MB blob / 100k dict)
while round 11 stays flat (492 KB / 23.1k) — churn profile 2's
unbounded-in-time leak is closed.  The `webgpu` Playwright projects
could not be validated on this Linux machine: the SwiftShader adapter
acquires (vendor google/swiftshader) but renders blank — identical
failures on the pre-round baseline commit, so a pre-existing
environment limitation, not this round; the mapper-runtime
epoch/repack behaviour is pinned by the Node mock-device suite
instead, and the webgpu projects should be re-run on a machine with a
working adapter before release.  (**Resolved 2026-07-29** — the blank
rendering was a Linux canvas-presentation issue in headless Chromium,
fixed with ANGLE-on-Vulkan compositing flags; all 51 specs now pass on
this machine.  See the next entry.)

## Landed (Linux WebGPU test environment fix, 2026-07-29)

Root-caused and fixed the "adapter acquires but renders blank" failure
that kept the `webgpu`/`webgpu-visual` Playwright projects from
validating on Linux (round 11's open verification debt).  Probing the
Playwright-launched Chromium (1.61.1, `channel: 'chromium'` new
headless) with the failure split into stages showed:

- **Dawn rendering was never broken.**  With the repo's flags, the
  adapter acquires and an offscreen render → `copyTextureToBuffer` →
  map readback produces correct pixels on *both* the SwiftShader
  adapter and the hardware one (RX 580, RADV, Mesa 25.3.6 — Vulkan 1.4
  is healthy on this box).
- **Canvas *presentation* was the failure.**  Under the default Linux
  GL compositor, `ctx.configure()`/`getCurrentTexture()` on a WebGPU
  canvas killed the instance ("A valid external Instance reference no
  longer exists"); under `--use-angle=vulkan` alone the canvas
  configured but composited transparent.  Composited (screenshot)
  pixels — what the specs assert — stayed blank either way, which is
  exactly the round-11 symptom.
- **The fix**: `--use-gl=angle --use-angle=vulkan
  --enable-features=Vulkan` routes Chromium's compositor through
  ANGLE-on-Vulkan, and the shared-image canvas path presents
  correctly for both the hardware and the SwiftShader-pinned WebGPU
  adapter.  Added to the `webgpu` and `webgpu-visual` projects in
  `playwright.config.js`, gated on `process.platform === 'linux'` —
  `--use-angle=vulkan` does not exist on macOS (Metal), so the
  known-good macOS configuration is untouched.
- **Determinism and CI are unaffected.**  The SwiftShader pin still
  applies to the *WebGPU* adapter (only compositing uses the AMD
  device), and the goldens generated on macOS pass here unchanged —
  confirming cross-platform golden stability.  Simulating a
  no-Vulkan-driver machine (a CI runner) yields a null adapter → the
  specs soft-skip exactly as before, so CI behaviour is unchanged.
- One quirk noted, no action needed: `drawImage()` from a live WebGPU
  canvas into a 2D canvas still reads transparent under these flags —
  no spec uses that path (they decode `page.screenshot()` or use
  `cy.png()` readback, both working).

**Verification**: 39/39 `webgpu` + 12/12 `webgpu-visual` specs green
on this machine (all 10 golden diffs within tolerance against the
checked-in macOS-generated PNGs, both v3-parity diffs within their 2%
bound) — round 11's "re-run on a machine with a working adapter"
caveat is cleared, and this Linux machine can run the visual projects
going forward.

## Logged — compaction (analysis; slot-stable tier landed round 11)

Discussed 2026-07-27 while planning round 10 and **deliberately left
out of that sprint**: the analysis below is settled.  The
**slot-stable tier landed in round 11** (above) with auto thresholds —
the "plausibly auto regardless" lean below, taken.  The *slot-moving*
policy calls were decided with the user 2026-08-01 and **the tier
landed as round 19** (the plan and Landed sections at the end of this
file); the analysis below is kept as the record that motivated it.

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
counters — it could safely run automatically.  (That is exactly how it
landed in round 11: waste-over-half thresholds with small floors, no
new API.)  **Slot compaction**
moves live elements, is metered by dead-slot ratio, and carries all the
policy weight: outstanding refs (plain `{group, slot, gen}` objects in
user-held collections, plus packed-int membership-set caches — they
cannot be found and rewritten eagerly), z-order (slot order is draw
order), GPU full re-upload (the existing `resized` path), and remap of
in-flight animation slot lists.

**Open policy questions** — these apply to the *slot-moving* tier only
(round 11 took the slot-stable lean of (b)); options discussed —
**all three decided with the user 2026-08-01, see the round-19 plan
at the end of this file**: (a) ref
survival across a slot move — a forwarding table with lazy ref repair +
an epoch stamp invalidating cached membership sets (**taken**), vs
handles-survive-collections-stale, vs everything-stale; (b) trigger —
explicit `cy.compact()` vs auto thresholds (**both taken**: auto
threshold + the explicit call); (c) draw order after
compacting — stable
(visually a no-op) (**taken**) vs restore-insertion-order (heals the
recycled-slot
z-order wart at the cost of a visible change and a per-slot sequence
number).

**Settled adjacent question**: removed-element readability is
*orthogonal* to compaction — v4 already gave it up when it chose
tombstones + a free-list (the next add may recycle the slot), and the
round-10 design call above makes that permanent.  Compaction changes
nothing for removed refs under any option: a removed ref matches no
forwarding entry and its generation is already stale, and the cached
`id()`/`group()` live on the JS handle, not in the columns.

## v3 → v4 parity gap analysis (2026-07-28)

A systematic sweep of the **entire v3 public surface**, diffed against
v4.  Sources: the v3 style registry (`src/style/properties.mts` — 280
registered properties + 11 aliases across 21 groups), the docmaker API
index for core and collection (cross-checked against the prototypes),
the v3 renderer's event/gesture emission (`load-listeners.mts`), the
layout and extension registries, and the documented init options —
diffed against `src/gpu/README.md` plus source spot-checks of
`src/gpu/`.  Every gap below is classified into one of four tiers:
**at parity**, **dropped by decided design** (recorded, no action),
**gap with direction set** (build when scheduled), and **needs a
call** (API semantics are never improvised autonomously).  A final
tier lists **proposed drops** — v3 features we suggest *not* porting;
none of those is decided until signed off.

### At parity (verified, no action)

Core viewport/events/data/batching, the whole collection
iteration/comparison/building surface (incl. `eq`/`first`/`last`/
`slice`/`toArray`/`anySame`/`symmetricDifference`/
`closedNeighborhood`), traversal, degree, flags/switches
(incl. `active`/`pannable`), the full v3 algorithm surface, layouts
grid/preset/circle/concentric/breadthfirst/random (+ `eles.layout()`
plumbing), `png`/`jpg` export options, `mount`/`unmount`/`destroy`,
`stop(clearQueue, jumpToEnd)`/`delay`/`delayAnimation`, box selection
with `selectionType`, pinch zoom, the cxttap/dbltap/taphold gesture
set, and `data`/`scratch`/`json()` export.  (Where v3 takes a
selector these take collections/queries/predicates — the decided v4
form, not a gap.)

### Dropped by decided design (recorded in src/gpu/README.md; ledger only)

Selector strings and `cy.$()`; classes; per-element style
bypass/setters (`style(name, value)`, `removeStyle`, `flashClass`);
style functions; CSS-string stylesheets and the
`cytoscape.stylesheet()` builder (follow from the `{ nodes, edges }`
object-sheet decision — worth recording explicitly);
selection-dependent restyling (`:selected` blocks → shader accent
ring); `restore`/`clone`/`copy` and `cy.json()` import; custom easing
functions and `spring(tension, friction)` (→ `spring(bounce)`); event
namespaces; v3 bubble order *within a phase* (registration order
instead; compound bubbling itself landed round 14.5 with v3's
cross-phase order); per-element `font-family`;
viewport-fixed labels; `renderTo`; `cy.notify`/`notifications`/
`noNotifications` (dirty-driven renderer).  Added by the 2026-07-29
triage (below): the canvas-era perf degradation options
(`hideEdgesOnViewport`, `textureOnViewport` + `outside-texture-bg-*`,
`motionBlur`/`motionBlurOpacity` — obsolete under compute culling +
adaptive render scale); `background-blacken` (subsumed by color
mappers); `bounds-expansion` (bounds are computed correctly instead);
and the legacy aliases (`content`, `autolockNodes`/
`autoungrabifyNodes`, `padding-{left,right,top,bottom}`, no-dash shape
spellings, redundant `attr`-family duplicates — one name per concept).

### Gaps with direction already set (build when scheduled)

- **Curved edges** — the single biggest *visual* gap.  **Pass 12a
  (bundled `bezier` + self-loops) landed 2026-07-30**, and **pass 12b
  (`unbundled-bezier`, `segments`, `round-segments`, `taxi`,
  `round-taxi`) landed 2026-07-30/31** — see the round records.
  Still open from v3's `curve-style`: `haystack` and
  `straight-triangle` plus manual endpoints (the 12c pass).
  Brings with it: **self-loops** (`loop-direction`/`loop-sweep` — a
  loop currently degenerates to a point in v4), `control-point-*`,
  `segment-*`, `taxi-*`, `radius-type`, `edge-distances`,
  `source/target-endpoint`, `source/target-distance-from-node`, and
  the accessors `controlPoints`/`segmentPoints`/
  `renderedControlPoints`/`isBundledBezier`.  Design tier decided
  (2026-07-24): dual CPU/WGSL impls, conservative CPU bound for
  cull/fit, exact lazy `.bb()`, membership as a structural index.
  The 2026-07-29 triage added `curve-style: haystack`
  (+ `haystack-radius`) and `straight-triangle` to this surface: kept
  as *real visual styles* (offset-endpoint and triangle-shaped edges),
  not perf modes — v4's culling makes the perf rationale moot but the
  looks stay.
- **Ghost props** (`ghost`/`ghost-offset-*`/`ghost-opacity`) — kept in
  the 2026-07-29 triage (SBGN needs them), in a simplified form: a
  ghost duplicates only the basic node body — shape, border,
  background — at the offset, an extra instance draw, never a
  whole-cloth redraw of the full node (labels and other decorations
  excluded).
- **Overlay/underlay theming** — the 2026-07-29 triage decided to
  *port the props* (the 10 overlay/underlay element style props plus
  the `active-bg-*` and `selection-box-*` core options) rather than
  keep the affordances baked in; the existing shader hover/active
  brighten, accent ring and DOM selection box become the styled
  defaults.
- **Multiline labels** — `text-wrap`/`text-max-width`/
  `text-justification`/`line-height`/`text-overflow-wrap` (+
  `ellipsis`).  Same decided tier (shaping memoizes; model-space
  keeps it zoom-invariant).
- ~~**Edge label autorotate** (`text-rotation: autorotate`)~~ —
  **landed 2026-07-29** (see the autorotate entry below); the flip
  rule call was taken as v3's verbatim undirected-slope angle.
  Per-element *numeric* `text-rotation` stays in the label-parity
  batch.
- **Force-directed layout** — v3's `cose` is the only built-in
  force layout, so v4 has *no* force option at all today; the GPU
  layout direction is logged (GPU-authoritative + readback, CPU
  reference for headless).  The concrete algorithm (port cose vs a
  modern fcose-class kernel) is the call to make when scheduled.
- **Compaction** — slot-stable tier (id blob / CSR / dictionary
  reclaim) **landed in round 11** with auto waste thresholds; the
  slot-moving tier still waits on the logged policy calls.
- **z-index** — mechanism named (more z-ranks or a `u32`
  index-indirection pass); decide together with compaction's
  draw-order call.  Restores `zDepth`/`sortByZIndex` and heals the
  recycled-slot draw-order wart.

### Needs a call (design open — grouped, with the v3 surface at stake)

1. ~~**Compound nodes**~~ — **landed as round 14** (2026-07-31; the
   plan and per-item records are at the end of this file): hierarchy
   in the columnar store, auto-sized parents materialized into the
   position/size columns, the parents sheet group + structural
   query/case terms, ancestor-gated visibility + rendered
   effectiveOpacity, ported event bubbling, compound loop edges,
   the parent draw stream, and layout/tween/interaction rules.
   The original scoping notes, for the record: the largest single
   absence.  Style: the
   8-prop compound group + `:parent` visuals + `padding`/
   `padding-relative-to` + `z-compound-depth`/`z-index-compare` +
   `compound-sizing-wrt-labels`.  Collection: `parent`/`ancestors`/
   `children`/`descendants`/`siblings`/`orphans`/`nonorphans`/
   `commonAncestors`/`isParent`/`isChild`/`isChildless`/`isOrphan`,
   `move({ parent })`, `forEachUp/Down`, compound-relative
   `relativePosition`, `effectiveOpacity` semantics, event bubbling
   through parents, cose nesting.  Needs its own design round:
   hierarchy in the columnar store, parent auto-bounds vs cull/bb,
   render order.
2. **Background images** (16 props) — per-node images/icons are
   ubiquitous in real apps (`background-image` + fit/clip/position/
   repeat/opacity/smoothing/crossorigin...).  GPU shape: a texture
   atlas or array keyed per element; interacts with the fixed-atlas
   discipline.  High app value; sizeable renderer feature.  **Landed
   as round 15 (2026-08-01, below): tiered texture arrays + mips,
   SVG zoom-promotion, an SDF icon mode, multi-image parity.**
3. **Pie / stripe backgrounds** (51 + 50 props) — SDF-friendly in
   principle; the call is whether v4 wants them (or a leaner
   generalization) at all.  **Call taken 2026-08-01 (third design
   sitting): yes, as the lean list-valued `chart` family designed
   for future chart kinds — scoped as round 23 (plan at the end of
   this file).**
4. **Node visual parity batch** — gradients
   (`background-fill`/`line-fill` linear/radial + stop props),
   `corner-radius` control, `border-style`/`-cap`/`-join`/
   `-dash-pattern`/`-dash-offset`/`-position`, the node `outline-*`
   group (5), custom
   `polygon` via `shape-polygon-points` (per-element point data),
   and the unported shape keywords (`round-*` family,
   `cut-rectangle`, `barrel`, `concave-hexagon`, `right-rhomboid`,
   `bottom-round-rectangle`).  Each is small-to-medium; needs a
   scope call on which subset earns its shader/channel cost.
   (`background-blacken` and `bounds-expansion` were in this batch
   until the 2026-07-29 triage dropped them.)
5. **Arrow parity** — `mid-source`/`mid-target` positions,
   `arrow-fill: hollow`, `arrow-width`, `arrow-scale`, compound
   shapes (`triangle-tee`/`circle-triangle`/`triangle-cross`/
   `triangle-backcurve`).  Mid-arrows are cheap on straight edges
   but really belong with curved-edge midpoint math.
6. **Label parity** — placement (`text-valign`/`text-halign` grid
   vs v4's fixed below-node), per-element numeric `text-rotation`,
   **source/target edge labels** (10 props — second/third label
   streams), `text-opacity`, `text-transform`,
   `font-style`/`font-weight`, `text-border-*`,
   `text-background-shape`, and per-element `min-zoomed-font-size`
   vs v4's global `labelFadePx`/`labelMinPx`.  Also: **labels are
   excluded from `boundingBox()`** in v4 — v3's `includeLabels`
   (and the bb options object generally) affects `fit()` semantics;
   the conservative-label-bound design (already sketched for
   multiline) is the likely answer.  **Landed as round 16
   (2026-08-01, below): the wrap family, and labels join bb/fit by
   default with { includeLabels } opt-out.**
7. **Event vocabulary** — v4 lacks the element state events
   (`grab`/`grabon`/`drag`/`free`/`freeon`/`dragfree`/
   `dragfreeon`), the normalized device events (`tapstart`/
   `tapdrag`/`tapend` + `vmouse*` aliases, raw `mousedown`/
   `mousemove`/`mouseup`/`click`), `tapdragover`/`tapdragout`
   hover-during-drag, `cxtdragover`/`cxtdragout`,
   `tapselect`/`tapunselect`, and the viewport-gesture variants
   (`dragpan`/`scrollzoom`/`pinchzoom`).  Event objects also lack
   `preventDefault`/`stopPropagation` and bubbling semantics.
   Mostly cheap plumbing, but every name is permanent API — one
   deliberate call on the v4 event vocabulary is better than
   accretion.  **Landed as round 17 (2026-08-01, below): the curated
   set plus the official pointer-event family.**
8. **Interaction options + touch parity** — `wheelSensitivity`,
   `touchTapThreshold`/`desktopTapThreshold`, configurable taphold
   duration, `pixelRatio`, per-element `events`/`text-events`
   (pointer-transparency), `box-selection: overlap` mode (v4 is
   'contain' only), two-finger cxttap on touch, and the
   three-finger box gesture (currently listed as not implemented).
   **Scoped as round 20 (2026-08-01, plan at the end of this
   file)**: the option quartet + `events`/`text-events` + both
   touch gestures; `pixelRatio` found already landed; the overlap
   box mode deferred as a demand-gated hook (not v3 surface).
9. **Animation surface** — `step` callback, `queue: false`,
   `renderedPosition` targets, Animation object controls
   (`pause`/`progress`/`reverse`/`apply`/`applying`/`completed` —
   v4's handle has `play`/`stop`/`promise`), and **style
   transitions** (`transition-property`/`-duration`/`-delay`/
   `-timing-function`): call whether transitions return as sugar
   over the animation system or stay out.  **Partially resolved
   2026-08-01 (third design sitting): v4 animations need not match
   v3 — the queue is dropped outright (round 21) and `step` stays
   out; controls and transitions remain the open follow-up.**
10. **Extension system** — `cytoscape.use()` and
    `cytoscape(type, name, registrant)` registration for
    layout/renderer/core/collection extensions.  v4 has none; this
    gates the entire external ecosystem (fcose, dagre, elk, cola,
    edgehandles, ...).  At minimum a v4 **layout extension
    contract** needs designing; core/collection extension points are
    a separate call.  **The layout contract landed as round 17
    (2026-08-01, below): direct objects, no registry;
    core/collection extension points stay deferred (recorded).**
11. **`display` vs `visibility`** — v3 distinguishes `display: none`
    (no space) from `visibility: hidden` (occupies space) from
    zero opacity; v4 has one `show`/`hide` flag.  Call: is one flag
    enough, and what do `visible()`/`takesUpSpace()` mean exactly.
    **Resolved 2026-08-01 (third design sitting): both tiers exist
    — show/hide stays the display tier (now re-fanning bezier
    bundles, v3's structural semantics), `visibility` lands as a
    mapper-capable style prop keeping space and bundle ranks —
    scoped as round 22 (plan at the end of this file).**
12. **Odds and ends** — `cy.gc()`, `cy.window()`,
    `cytoscape.warnings()`, graph-level `data` in the wire format,
    `panBy` animation target, layout instances as event emitters
    (v3 layouts have `on`/`promiseOn`; v4 layout events fire on the
    core only).

### Proposed-drops triage (decided 2026-07-29)

The proposed-drops list was triaged with the user in one sitting;
every entry now has a decision.

- **Dropped** (added to the decided-design ledger above):
  - **Canvas-era performance hacks** — `hideEdgesOnViewport`,
    `textureOnViewport` (+ `outside-texture-bg-*`), `motionBlur`/
    `motionBlurOpacity`.  Obsolete under WebGPU + compute culling +
    adaptive render scale, which solve the same problem without
    degrading interaction.
  - **`background-blacken`** — subsumed by color mappers (compute the
    shade in the mapper range instead).
  - **`bounds-expansion`** — a manual bb-correction escape hatch;
    unnecessary when bounds are computed correctly.
  - **Legacy aliases** — `content`, `autolockNodes`/
    `autoungrabifyNodes`, `padding-{left,right,top,bottom}`, the
    no-dash shape spellings (`roundrectangle` etc.), `attr`-family
    duplicates beyond the ones already kept.  One name per concept.
- **Kept** (moved to "gaps with direction set" above):
  - **`curve-style: haystack` (+ `haystack-radius`) and
    `straight-triangle`** — ported as *real visual styles*, not perf
    modes, alongside the curved-edge work.
  - **Ghost props** (`ghost`/`ghost-offset-*`/`ghost-opacity`) —
    needed for SBGN, kept with simplified scope: the ghost duplicates
    only the basic node body (shape, border, background) at the
    offset — an extra draw, but simple — never a whole-cloth redraw
    of the full node (labels and other decorations excluded).
  - **Overlay/underlay as style props** (10 props + `active-bg-*` +
    `selection-box-*` core props) — port the props; the baked-in
    affordances (shader hover/active brighten, accent ring, DOM
    selection box) become the styled defaults.
- **Deferred into the multiline/label-bb round** (the listed lean,
  now decided): **`text-metrics`**, **`box-select-labels`** — their
  v4 form is designed there; neither ported as-is nor dropped now.

### Suggested sequencing (unchanged by the sweep, now grounded in it)

The sweep confirms the two headline pillars — **curved edges** and
**compounds** — dwarf everything else in app impact, with
**background images** the sleeper third (16 props, near-universal in
production apps).  Of the near-term autonomous work, slot-stable
compaction landed as round 11 and edge-label autorotate landed
2026-07-29 — the autonomous shelf is clear.  The
design queue, in suggested order: curved
edges (12a — bundled bezier + self-loops — landed 2026-07-30 and 12b —
unbundled/segments/taxi — 2026-07-30/31; 12c endpoints +
haystack/straight-triangle remains; since complete) → compounds
(landed as round 14, 2026-07-31) → background images + the
node-visual scope call
(ghost's simplified body-duplicate form slots in here) → the event
vocabulary + extension contract calls (cheap to build once decided,
and they unblock the ecosystem) → force layout.  Overlay/underlay
theming props ride with the interaction/visual batches.  The
proposed-drops list was triaged 2026-07-29 (see the section above):
four entries dropped into the decided-design ledger, three kept with
direction, and `text-metrics`/`box-select-labels` folded into the
label-bb round.

**2026-08-01 design sitting**: with rounds 12–14 landed, the
remainder of the queue was scoped in one sitting (plans at the end
of this file): **z-index dropped outright** (decided design, no
round at all) → background images (round 15) → multiline labels +
label bb (round 16) → event vocabulary + extension contract
(round 17) → GPU force layout (round 18).  **All four rounds landed
in full the same day** — the queue is clear.

## Round 12 plan — curved edges (planned 2026-07-29)

The head of the design queue: v4 renders `curve-style: straight` only,
and the curve families are the single biggest visual gap — bundled
bezier is v3's *default* look, and a self-loop currently degenerates
to a point in v4 (a standing correctness wart, not just a missing
style).  The design tier was decided 2026-07-24 (the expensive-GPU-
geometry model): **dual CPU/WGSL implementations that agree by
construction** — never one side reading back the other — with a
**conservative CPU over-approximation for cull/fit**, **exact lazy
CPU eval memoized per element for public `.bb()`**, and bundle
*membership* as a cheap CPU structural index rebuilt on edge
add/remove/move, not per frame.  The 2026-07-29 triage added
`haystack` (+ `haystack-radius`) and `straight-triangle` to this
surface as real visual styles.  This section slices the work into
passes and records the implementation calls so the passes can run
under the round-10 process rules (isolated commits, docs in-commit,
full verify per item, escalation on any real API call discovered
mid-implementation).

**Implementation calls (made at planning):**

- **Geometry ports v3's math verbatim.**  Control points, loop
  construction, segment/taxi routing and endpoint math come from the
  same formulas v3 uses (`src/extensions/renderer/base/coord-ele-math/
  edge-control-points.mts` — the step-size stagger for bundles, the
  loop-direction/sweep construction, the distance/weight frame for
  unbundled beziers and segments, the taxi turn logic), so curves are
  pixel-comparable in the live v3-parity harness and existing figures
  reproduce.  No silent simplifications: any spot where v3's math
  can't ride the GPU path becomes its own logged call.
- **Curves evaluate in the vertex stage from live endpoint positions
  plus per-edge curve parameters.**  Rendered curves are instanced
  segment strips — K quads per edge instead of 1 — whose VS computes
  the curve point analytically from the two endpoint positions (the
  same buffer straight edges already fetch) and a small per-edge
  parameter record (curve kind, bundle offset, loop angles, segment/
  taxi params).  The parameters are position-independent (offsets and
  weights in the endpoint-relative frame), so drags, layouts and
  position tweens follow on-GPU with **zero rebuild**, exactly like
  straight edges, arrows and edge labels today.  Variable-length
  params (segment lists) live in a param blob + per-edge offset
  column — the one storage-layout addition.  K is fixed per curve
  family (bezier/loops subdivide; segments/taxi are exact polylines,
  K = their true segment count), with a far-zoom LOD reduction as a
  tune knob resolved by goldens + the renderer benchmark during 12a —
  not an API surface.
- **One flattening, every consumer.**  The CPU twin evaluates the
  same closed forms: exact lazy `.bb()` (memoized, invalidated by the
  same dirty channels that invalidate the render), CPU pick against
  the flattened polyline at the same subdivision the shader draws (so
  pick agrees with pixels by construction; the GPU pick tile draws
  the same segment strips for the edge stages), and cull/fit read the
  conservative bound — endpoint hull expanded by the maximum control
  offset (bundle stagger, loop extent, segment/taxi excursion) — per
  the decided tier.  Arrows sit on the endpoint node's boundary along
  the curve's **end tangent**; edge labels anchor at the curve
  midpoint (t = 0.5) computed in the VS, so autorotate's angle
  generalizes from the endpoint delta to the midpoint tangent.
- **Box selection keeps endpoint-center containment in 12a** (the
  existing straight-edge approximation, already a recorded
  deviation); upgrading `refsInBox` is revisited with 12b when the
  CPU evaluator covers every family.  (Since done: 12b's revisit took
  v3's exact rule — curved edges test their *curve boundary
  endpoints*, which is what v3's 'contain' actually checks, rather
  than the flattened polyline; straight edges keep centers.)

**Pass split** (each pass lands as isolated commits with Node
geometry tests pinned against v3's math, a golden scene per family, a
live v3-parity scene under the standard tolerance bound, and a
follows-drag/tween Playwright spec pinning the zero-rebuild property):

- **12a — bundled bezier + self-loops** (landed 2026-07-30 — see the
  round 12a record; the default v3 look, and the loop fix): `curve-style` prop (`straight` | `bezier`),
  `control-point-step-size`, `control-point-weight`, `loop-direction`,
  `loop-sweep`; the parallel-edge bundle membership index (keyed on
  the unordered endpoint pair, incremental on add/remove/`move()`);
  the curve-params column + VS quadratic-bezier eval for render and
  pick tile; arrows on end tangents; edge labels at the curve
  midpoint; conservative bound into cull/fit/`boundingBox`; exact
  lazy `.bb()`; `isBundledBezier`/`controlPoints`/
  `renderedControlPoints` accessors.
- **12b — unbundled-bezier + segments + taxi (+ round variants)**
  (landed 2026-07-30/31 — see the round 12b record):
  `control-point-distances`/`-weights`, `edge-distances`,
  `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `round-segments` corner arcs, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`, `round-taxi` radius; the param-blob
  storage for variable-length lists; `segmentPoints`.
- **12c — endpoints + the triage keeps**: `source/target-endpoint`
  (keyword/percent/coordinate forms),
  `source/target-distance-from-node`; `haystack` (+
  `haystack-radius`) as hash-stable intra-node endpoint offsets (the
  decimation trick's determinism, applied to endpoints);
  `straight-triangle`.  Mid-arrows (`mid-source`/`mid-target`,
  `arrow-scale`, `arrow-fill: hollow`, compound arrow shapes) stay in
  the arrow-parity needs-a-call batch — not pulled in here.

Perf: the renderer benchmark gains a curved variant of the pan
scenes (expected cost is ~K× edge vertex work, bounded by cull and
decimation; record the numbers in the round record).

**Open calls — both signed off 2026-07-30** (as the leans):

1. **v4's default `curve-style` is `straight`** — the perf-first
   default at v4's target scales; parity scenes and apps opt into
   `bezier` explicitly.  A deliberate divergence from v3's
   bundled-bezier default, recorded in `src/gpu/README.md`.
2. **`bezier` bundles multi-edges only, verbatim v3**: a lone edge
   between two nodes stays a straight line under `curve-style:
   bezier`; only parallel edges fan out (the odd-bundle middle edge
   is straight too, v3's rule).  Pixel-comparable in the live
   v3-parity harness.

## Landed (round 12a — bundled bezier + self-loops, 2026-07-30)

Ran under the round-10 process rules (isolated commits, docs
in-commit, full verify per item, escalation on real API calls).  Items
landed in CPU-first order; each entry below was written in the commit
that landed it.  (Since superseded: pass 12b — unbundled/segments/taxi
— landed 2026-07-30/31, see its round record; pass 12c — endpoints +
haystack/straight-triangle — remains in the round-12 plan above.)

- [x] **Curve geometry module + contract columns.**
  `src/gpu/curve-geometry.mts` is the CPU half of the dual-impl
  discipline for curves: v3's math ported verbatim (bundle stagger
  `(0.5 − n/2 + i)·step`, loop rays `loopDir − π/2 ∓ sweep/2` at radius
  `1.4·step·(j/3 + 1)`, the `edge-distances: intersection` frame with
  the impossible-bezier clamp, endpoints on the node boundary toward
  the near control point, the loop's two C1-continuous quadratics
  through the control midpoint), with node boundaries at the arrow
  shader's approximation tier (ellipse/rect exact, round-rect as box,
  polygon as inscribed ellipse — recorded deviation).  Also:
  `curvePointAt`/`flattenCurve` (the drawn subdivision, CURVE_SEGS =
  24) and the conservative `curveDeviation` hull bound for cull/fit.
  Contract: `edge.curveParams` column (f32×4; kind packed at [3] so
  the curve shaders fit the vertex stage's 8-storage-buffer budget)
  + `CURVE_*` kinds + the store-managed `FLAG_CURVED` bit the cull
  kernels will split the edge streams on.  17 Node specs pin the port
  against hand-derived v3 values (incl. the antiparallel-edge
  world-invariance of the stagger sign and the C1 loop join).
- [x] **Curve style props + bundle index + param derivation.**  Five
  edge props (`curve-style` straight|bezier, `control-point-step-size`,
  `control-point-weight`, `loop-direction`, `loop-sweep` — v3 defaults;
  angles take numbers-as-radians or deg/rad strings, constants and
  mappers alike, stored-truth readback off the styled record, nodes
  group throws).  `store/curve-index.mts` owns the styled records and
  derives `edge.curveParams`: a lazily-built parallel-edge pair map
  (straight-only graphs pay nothing but a loop check per edge add),
  always-maintained per-node loop lists, and pending-pair lazy flush
  (takeDelta / boundingBox / accessor reads) so a bulk load or style
  apply derives each pair once.  v3 rules pinned: 2-bundle ±step/2
  stagger, odd-middle straight, lone-bezier straight, per-edge step,
  antiparallel sign flip, loop j-stagger per (direction, sweep), and
  re-derivation on add/remove/`move()`/restyle/mapper-refresh.
  `store.boundingBox()` grows its edge term by the conservative hull
  deviation, and `store.curveSlack()` gives the frame-level bound the
  cull kernels will use (monotone maxima — never shrinks, costs only
  cull efficiency).  24 Node specs (`test/gpu-curve-index.mjs`).
- [x] **Curve-aware accessors + the exact lazy edge bb.**
  `isBundledBezier()` (style check, v3 semantics — true for the lone
  edge that renders straight), `controlPoints()` (one point for a
  bundled bezier, two for a loop, undefined for straight — v3's
  surface) + `renderedControlPoints()`; `midpoint()` returns the curve
  midpoint (v3's rs.mid) and `source/targetEndpoint()` return the
  curve's boundary endpoints for curved edges (straight edges keep the
  node-center approximation).  `eles.boundingBox()` reads the **exact
  lazy tier**: `store.curveBBAt()` flattens the curve at the drawn
  subdivision and memoizes per slot against a geometry epoch (any
  geometry write invalidates all cached boxes at once — sound, cheap,
  and consistent with the position-tween lease).  `boundingBoxAt`
  (animated-layout fit targets) expands curved edges by the
  conservative hull deviation.  16 Node specs
  (`test/gpu-curve-accessors.mjs`).
- [x] **Renderer: the curved-edge pipeline, cull stream and pick.**
  `CURVED_EDGE_SHADER` + `CurvedEdgePipeline`: one instance per curved
  edge drawn as a strip of CURVE_SEGS quads whose VS evaluates the
  curve (the WGSL twin of `curve-geometry.mts` — same intersection
  frame, boundary approximations, clamps) from live positions + the
  params column; vertices extrude along the curve normal *at their own
  t*, so adjacent quads share exact edge geometry and the strip is
  watertight without miters.  The vertex stage binds exactly 7 columns
  + the visible list (the base 8-storage-buffer budget); paint columns
  (line color/opacity/line-style) moved to the fragment stage via flat
  instance fetch, and dashes ride a per-vertex polyline arc-length
  varying.  Cull: a new `curvedEdge` kind splits the edge draw on
  FLAG_CURVED (the straight predicate rejects the bit) — same five
  inputs, chord test grown by `frame.curveSlack` (the Frame uniform's
  spare pad slot), no decimation on the curved stream; `CullInfo`
  gained `indexCount` so one scan kernel serves both 6-index quads and
  6×CURVE_SEGS strips.  The pick pass draws the same strips
  (edges-only tile, `pickCull.curved`), so pick coverage equals pixels
  by construction; image export gained the curved group too.  One
  init-order bug found by the specs: the mirror's construction-time
  full upload ran *before* the lazy curve flush whose usual flush
  point (takeDelta) is discarded at init — flush now runs first.
  Verified: 3 new `webgpu` specs (fan-off-the-chord with pixels at
  the CPU-computed `renderedMidpoint` — the dual-impl guarantee made a
  test; ≤64 B re-shape on drag; pick on the bulge vs chord; loops
  render as loops), 2 new goldens (`bezier-bundles`, `self-loops`),
  and a live v3-parity curve scene measuring **0 differing pixels**
  (8px strokes so pixelmatch's AA skip can't mask placement error,
  plus an ink guard) — 59/59 Playwright, 1707 Node, 59 module tests,
  typecheck + lint green; pre-existing goldens byte-identical.
- [x] **Arrows on curve end tangents.**  The insight that made this a
  small change: a quadratic's end tangent points from the control to
  the endpoint, so the curved arrow is *the straight arrow math with
  the control point substituted for the far endpoint* (source end uses
  c1, target end c2 — coincident for a bundled bezier).
  `CURVED_ARROW_SHADER`/`CurvedArrowPipeline` ride the curved cull
  stream's new **single-quad args block** (the scan kernel now writes
  a second `[6, n, 0, 0, 0]` at byte 20 of the indirect buffer, so
  strip streams can also drive one-quad-per-instance draws).  Budget
  cut, recorded: no node-border column fits in the 8-buffer vertex
  stage, so curved-edge arrow tips sit on the size/2 boundary and the
  frame uses border-exclusive halves — exact for the default border 0,
  ≤ border/2 off otherwise (revisit with 12c endpoints).  New
  `curved-arrows` golden (bundle fan converging on the target, an
  antiparallel pair, a loop arrow riding the in-ray tangent); 60/60
  Playwright, 1707 Node, 60 module tests green.
- [x] **Edge labels at the curve midpoint + autorotate tangent.**  The
  edge label VS binds the curve inputs (7 storage buffers + the
  visible list — exactly the vertex-stage budget) and anchors curved
  owners at the curve midpoint computed from live positions, so
  curved-edge labels keep the zero-rebuild property.  Autorotate
  generalizes for free on beziers — a quadratic's t = 0.5 tangent *is*
  the chord direction, so the existing endpoint frame is already exact
  — and loops rotate along their c1→c2 midpoint tangent.  The
  edge-glyph cull (at its own 8-buffer budget, no params binding)
  grows its chord-midpoint test by the frame's curve slack for
  FLAG_CURVED owners; rotated curved labels take a frame-independent
  anchor-centred bound (a loop's rotation frame differs from the
  chord's).  New webgpu spec (glyphs at the CPU-computed
  `renderedMidpoint`, none on the chord, ≤ 64 B re-anchor on drag) +
  `curved-edge-labels` golden (bundle labels per-curve, an autorotated
  boxed label tilted with the chord, a loop label on the loop
  tangent); 62/62 Playwright, 1707 Node, 60 module tests green.
- [x] **Renderer benchmark: the curved pan scene.**  A new
  `gen-25k-curved` scene generates its 50k edges as parallel *pairs*
  (a lone bezier renders straight, so a random-edge scene would
  measure nothing) with `curve-style: bezier` opted into on both
  sides; the runner also gained the platform-gated Linux
  ANGLE-on-Vulkan flags from playwright.config.js — without them it
  silently fell back to SwiftShader (and the software rasterizer then
  lost the device under the curved load).  Same-machine A/B on this
  box (AMD RX 580 / RADV, dpr 2, 1280×800, scale pinned 1), GPU
  device-time p50, straight `gen-25k` vs `gen-25k-curved`:
  continuous-pan fit-all 3.3 → 8.6 ms (~2.6× for 24 quads/edge over
  every edge — well under a 60 fps frame; wall clock stays
  vsync-bound at 16.7 ms on both scenes), zoomed-in 20× 4.4 → 3.8 ms
  (culling keeps the curved stream cheap), far-zoom 1.2 → 6.4 ms —
  the documented no-decimation trade-off on the curved stream showing
  up exactly where expected (revisit with 12c's haystack).  v3 canvas
  ~650 ms/frame fit-all either way (bezier barely moves its cost);
  init 3.0 s v3 vs 169 ms gpu; hover-while-panning pick p50 ~18 ms on
  this box.  Round 12a is complete: props, derivation, accessors,
  exact bb, render, cull, pick, arrows, labels, goldens, parity and
  benchmarks all landed.

## Landed (round 12b — unbundled bezier + segments + taxi, 2026-07-30/31)

Pass 12b of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12b is complete**: props, blob storage, per-edge
derivation, accessors, exact bb, render, cull, pick, arrows, labels,
box selection, goldens, live v3 parity and benchmarks all landed —
final tallies in the goldens/parity entry at the end.

- [x] **`node.outerHalf` derived column — the 12b binding budget.**
  The curved-edge/curved-arrow/edge-label vertex stages all sat at
  WebGPU's base 8-storage-buffer budget after 12a, leaving no slot for
  the variable-length curve **param blob** 12b needs (segment/control
  lists can't fit the fixed f32×4 params column).  The fix is a derived
  column: `node.outerHalf` = size/2 + borderWidth/2 per axis (v3's
  outerWidth/outerHeight frame), written through by the store on every
  node size/border write, never by the style engine.  The four
  boundary-consuming shaders (curved edge, straight + curved arrows,
  edge labels) bind it in place of the size + border pair — one binding
  freed in each — and `GraphStore.curveEvalAt` reads the same column,
  so the CPU twin and the WGSL consume identical f32 half-extents by
  construction.  Two side effects, both improvements: the 12a
  **border-exclusive curved-arrow deviation is gone** (tips sit on the
  border-inclusive outer boundary, like straight arrows — the
  curved-arrows golden uses border 0, so goldens are unchanged), and
  border writes now invalidate the pick-tile cache through the derived
  column's span (`node.borderWidth` itself is pick-neutral, but
  borders move curved pick geometry — a latent 12a gap).  Node specs
  cover the write-through and its dirty span.
- [x] **CPU route geometry** (`curve-geometry.mts`): the CPU half of
  the dual-impl discipline for the three 12b families.  `evalRoute`
  computes the interior route points — unbundled-bezier controls and
  segment points from v3's weighted-frame + perpendicular-offset
  formulas ('intersection' and 'node-position' frames, keeping v3's
  quirk that the normal always comes from the intersection frame), and
  the full verbatim taxi routing (auto/explicit directions, percent/px
  turns incl. negative = from-target, min-distance clamps with the Z-
  and L-shape fallbacks, node-body offsets, the forced-direction
  growth case) — plus boundary endpoints toward the first/last route
  point.  `computeCorner` is v3's `getRoundCorner` as a pure function
  (spec-pinned *directly against* `src/round.mts` output across
  windings, arc- vs influence-radius, limit clamps and collinear
  corners).  The drawn strip stays one indirect draw of CURVE_SEGS
  quads for every family: `quadPiece` maps subdivision indices onto
  route pieces (multibezier: one C1 quadratic per control through
  inserted midpoints; polylines: legs, with corner arcs interleaved
  when round) such that **piece boundaries land exactly on subdivision
  indices** — legs stay pixel-straight and corners exact regardless of
  quad distribution.  That requires pieces ≤ CURVE_SEGS, so interior
  counts are capped (`MAX_MULTI_CTRL` = 8 controls, `MAX_CURVE_PTS` =
  11 segment points — a recorded deviation from v3's unbounded lists;
  derivation clamps with a warning).  `routeMidpoint` ports v3's
  label-anchor/autorotate rules per family (even/odd counts, the round
  arc-apex case with its arc tangent).  Contract: `CURVE_MULTI`/
  `CURVE_SEGMENTS`/`CURVE_TAXI` kinds + `FLAG_CURVED_BOX` (taxi
  routes — and weight-extrapolated routes — are not chord-bounded, so
  kernels without a params binding will cull them against the endpoint
  AABB grown by slack + chord length).  33 Node specs
  (`test/gpu-curve-routes.mjs`).
- [x] **The curve param blob** (`store/curve-blob.mts`).  Blob-backed
  kinds store their variable-length records in one f32 pool the
  renderer mirrors as a storage buffer; the params column holds the
  header `[blobOffset, dev, n, kind]` — no column-layout change, and
  records are position-independent, so drags/layouts/tweens still cost
  zero blob traffic.  Record layouts (multi: mode + d/w pairs;
  segments: mode + round + d/w/r/arc quads; taxi: 8 fixed floats) are
  documented in the module.  Storage behaviour follows the round-11
  slot-stable policy: append allocation with per-slot ranges,
  same-length rewrites in place, freed ranges metered, and automatic
  compaction past waste > half live (256-float floor) — a compaction
  rewrites records in slot order and reports moves so the store
  rewrites the header offsets as normal column spans (geometry
  unchanged, so the bb memo epoch is untouched).  `StoreDelta` gains
  an optional `curveBlob` span/resized entry and `ModelView` exposes
  `curveBlob()`/`curveBlobLength()`; `GraphStore.setCurveParamsBlob`
  writes record + header + FLAG_CURVED/FLAG_CURVED_BOX, feeds the
  monotone dev/box maxima behind `curveSlack()`, and fixed-kind writes
  release any blob record the slot held.  10 Node specs
  (`test/gpu-curve-blob.mjs`).
- [x] **Style props + per-edge derivation.**  `curve-style` gains the
  five 12b keywords; the full prop surface (`control-point-distances`/
  `-weights`, `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `edge-distances`, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`/`taxi-radius`) parses with v3 defaults,
  list props accepting arrays or space-separated strings, and
  stored-truth readback (lists as space-separated strings, percent
  turns as percent strings).  Scalars/enums are mapper-capable;
  **list props are constants-only** (recorded scope note).
  `edge-distances: 'endpoints'` throws until 12c.  The CurveIndex
  derives blob records **per edge** (the 12b families never bundle):
  v3's min(dists, weights) count rule, last-radius/type repetition,
  the weight clamp to [-1, 2] with out-of-[0, 1] weights marking
  FLAG_CURVED_BOX, taxi always box-bounded, and the interior-count
  caps.  Pair interplay pinned: blob-family members never join nor
  get clobbered by bezier bundle re-derivations, and a blob edge
  restyled to straight resets through the per-slot pending path (the
  pair map is bezier-lazy and may not exist).  Loops: unbundled
  families take `control-point-distances[0]` as the loop distance
  (v3), step-size fallback when unset; segments/taxi loops keep the
  12a all-loops-render-as-loops deviation.  Conservative-bb call
  sites (store scan + `boundingBoxAt`) use the header deviation, with
  box-bounded edges adding the node-half margin (+ chord length for
  extrapolated weights).  26 Node specs
  (`test/gpu-curve-derivation.mjs`); one 12a spec updated (the
  keyword-throw now pins `haystack`).
- [x] **Route accessors + the exact lazy bb.**
  `GraphStore.curveRouteAt` is the route twin of `curveEvalAt` (which
  now correctly returns null for blob kinds instead of misreading
  their headers as bezier params): blob record + live
  positions/outerHalf/shapes → the evaluated `CurveRoute`.  On top of
  it: **`segmentPoints()`/`renderedSegmentPoints()`** (v3's
  getSegmentPoints — defined for segments *and* taxi, whose derived
  routing points read back; undefined otherwise), `controlPoints()`
  extended to the unbundled-bezier control list (segments/taxi stay
  undefined, v3's split), `midpoint()` via the per-family
  `routeMidpoint` rules, `source/targetEndpoint()` as the route's
  boundary endpoints, and `curveBBAt` flattening routes at the drawn
  subdivision into the same epoch-memoized exact-bb cache.  12 Node
  specs (`test/gpu-curve-route-accessors.mjs`) pin hand-derived
  geometry incl. the taxi bb and memo invalidation on moves.
- [x] **Renderer: the route WGSL twin, blob mirror and box cull.**
  `ROUTE_WGSL` mirrors the CPU route evaluator step for step — the
  frame, the full taxi routing, `computeCornerW` (getRoundCorner), the
  piece allocator and `routeVertexW`/`routeMidpointW` — reading the
  same blob the CPU reads, mirrored by ColumnMirror as one storage
  buffer under the usual span/realloc rules (`delta.curveBlob`; a
  realloc bumps `mirror.version`, so bind groups rebuild).  The curved
  edge VS binds the blob as its 7th vertex buffer (back at exactly the
  8-buffer budget) and branches per kind: bezier/loop keep the 12a
  analytic path byte-for-byte (goldens stable), route kinds evaluate
  `routeVertexW` at their subdivision index with **discrete miter
  normals** from the neighbouring indices — exact miters at sharp
  polyline corners (v3's canvas join, extrusion scaled 1/cos(θ/2),
  clamped at 6), chord-normals elsewhere, canonical per index so the
  strip stays watertight; extruding along the miter keeps the
  perpendicular half-width exact, so the FS's AA is unchanged.  Dashes
  keep the chord-sum arc length over the drawn polyline.  The curved
  cull kernel branches on FLAG_CURVED_BOX to the endpoint-AABB test
  grown by slack + chord length (taxi and extrapolated weights are not
  chord-bounded); the edge-glyph cull grows its anchor test the same
  way for box owners.  The pick tile draws the same strips, so pick
  coverage equals pixels for every family — spec-pinned.  4 new
  `webgpu` Playwright specs: segments polyline + ≤64 B re-route on
  drag, taxi axis-aligned legs + leg-vs-diagonal picking,
  round-segments corner-cutting vs the sharp corner (and the arc-apex
  midpoint), and the unbundled-bezier S through its inserted midpoint
  with a clear mirrored band.  All 66 Playwright specs green; 12a
  goldens byte-stable through the shader restructure.
- [x] **Arrows + edge labels on routes.**  The curved-arrow insight
  generalizes: a route's end tangent runs from the first/last interior
  route point to the boundary endpoint, so the arrow is the straight
  arrow math with that point substituted (taxi arrows ride the final
  axis-aligned leg).  Budget: the curved-arrow vertex stage needed the
  blob, so this end's arrow *colors* moved to the fragment stage — the
  VS no longer collapses no-arrow ends to degenerate quads (they
  rasterize a small fully-transparent quad instead; the frame uniform
  now binds V|F for edgeDim).  Edge labels of route edges anchor at
  `routeMidpointW` in the VS, and autorotate takes the midpoint
  tangent as its frame (v3's per-family disp rules) — both zero
  rebuild, both spec-pinned: taxi arrows purple on the final leg (and
  no ink on the chord diagonal), segments labels at the route midpoint
  with a ≤64 B re-anchor on drag.  68/68 Playwright specs; the 12a
  curved-arrows golden is byte-stable through the fragment-stage
  color move.
- [x] **Box selection: the curve-endpoint upgrade** (the revisit
  deferred from 12a).  `refsInBox` now tests a curved edge's *curve
  boundary endpoints* — exactly v3's on-boundary 'contain' rule, via
  the full-family CPU evaluator (curveEvalAt / curveRouteAt); straight
  edges keep the endpoint-center approximation (recorded deviation).
  2 new Node specs (segments and taxi containment, incl. the
  cut-the-launch-point miss cases).
- [x] **Goldens, live v3 parity and the benchmark check.**  Three new
  golden scenes — `unbundled-bezier` (S-splines across orientations, a
  dashed run, the unbundled loop), `segments-families` (sharp miter
  vs radius-18 round corners on the same zig-zag lists, a vertical
  round run, dashes riding legs) and `taxi-families` (auto/explicit
  directions, px and percent turns, round-taxi corners, arrows on the
  final legs, the forced-direction growth case) — byte-stable across
  repeat runs.  One combined **live v3-parity scene** covering all
  five families measured **0 differing pixels** at 8 px strokes (the
  same ink-guarded pixelmatch bound as 12a's parity-curves): the
  route geometry lands identically on both renderers; the known
  miter-vs-round join difference is absorbed by AA classification.
  Renderer benchmark re-run on the same box (RX 580, dpr 2, scale 1):
  the 12a curved scene's device times are unchanged (fit-all pan
  8.61 vs 8.6 ms, zoomed-in 3.81 vs 3.8, far-zoom 6.18 vs 6.4) — the
  route branch and blob binding cost the bezier path nothing
  measurable; wall clock stays vsync-bound at 16.7 ms while v3 canvas
  runs ~670 ms/frame on the same scene.  Final tallies: 1793 Node +
  60 module tests, 72/72 Playwright specs (6 new `webgpu`, 3 new
  goldens + 1 new parity in `webgpu-visual`), typecheck + lint clean.

## Landed (round 12c — endpoints + haystack + straight-triangle, 2026-07-30/31)

Pass 12c of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12c is complete**: props, derivation, accessors,
exact bb, render, cull, pick, arrows, labels, box selection, goldens,
live v3 parity and benchmarks all landed — the round-12 curved-edges
plan (12a/12b/12c) is done.

- [x] **Contract + CPU geometry: endpoint blocks, haystack, triangle**
  (2026-07-30).  Three additions to the curve contract:
  `CURVE_HAYSTACK` and `CURVE_TRIANGLE` are *straight-stream* kinds
  (FLAG_CURVED stays clear — haystack rides the straight pipeline and
  its far-zoom decimation, resolving 12a's "curved stream is never
  decimated" revisit by construction), and `CURVE_HAS_ENDPT` flags a
  blob-backed kind (MULTI/SEGMENTS/TAXI) whose record is prefixed by a
  fixed 10-float **endpoint block** —
  [mode, a, b, pctBits, dist] × 2 — resolving `source/target-endpoint`
  and `source/target-distance-from-node`.  Modes are v3's edgeEndpoint
  forms (outside-to-node default, inside-to-node, outside-to-line,
  point with per-component %/px units, angle with the 12-o'clock start
  folded in at parse time); distances shorten via v3's
  `shortenIntersection` clamp rule.  Structural calls, recorded in the
  geometry module doc: a *straight* edge with manual endpoints derives
  as `CURVE_MULTI n = 0` (the route degenerates to the chord between
  the resolved endpoints — `routeVertex`/`routeMidpoint` already
  handle it), and a *bundled bezier* with manual endpoints promotes to
  `CURVE_MULTI n = 1` (its control formula is identical — pinned by a
  spec against the 12a analytic path).  `edge-distances: 'endpoints'`
  re-bases the frame on the raw manual anchors with v3's
  recalcVectorNormInverse normal.  Haystack endpoints are
  `center + (cos/sin(angle) · outerHalf · radius)` with **hash-stable
  angles from the edge's id hash** (deterministic across sessions and
  machines — v3 uses Math.random(), so haystack scenes are only
  statistically v3-comparable; v4 also scales by outer halves where v3
  uses inner size — identical at border 0, recorded).  17 Node specs
  (`test/gpu-curve-endpoints.mjs`) pin the block resolution, the
  n = 0 chord, the bezier-promotion equivalence, the endpoints-frame
  rebase, taxi distances, and the haystack point/angle math.
- [x] **Style props + derivation** (2026-07-30).  `curve-style` gains
  `haystack` | `straight-triangle`; new edge props `haystack-radius`
  (validated [0, 1], v3 default 0), `source/target-endpoint`
  (keyword | 'x y' point with per-component %/px units | angle as
  deg/rad string or plain radians; the `-or-label` keywords throw —
  no label bb in v4), and `source/target-distance-from-node`
  (non-negative).  `edge-distances: 'endpoints'` parses; derivation
  enforces v3's both-ends-manual rule and falls back to intersection
  with v3's warning otherwise.  Scalars (`haystack-radius`, the two
  distances) are mapper-capable; the endpoint props are
  constants-only (the point form is a list — the 12b scope rule).
  Derivation (CurveIndex): haystack derives per edge into the
  straight-stream params (id-hash angles via the store's blob-native
  id hashes, so two loads of the same graph derive identical
  haystacks); triangle likewise; any edge with a non-default endpoint
  spec derives its blob record with the 10-float block prefix and the
  kind flag — straight → MULTI n = 0, bundled bezier → promoted
  MULTI n = 1 (derivePair consults the spec; the odd-middle/lone
  rules produce endpoint chords), taxi → modes forced default (v3's
  keyword override) with distances kept, dropping the flag when
  nothing remains.  Cull soundness: px point offsets fold into the
  record's header deviation; pct offsets are measured in node-half
  units — ≤ 1 is covered by the slack's node-half term, > 1 marks the
  edge FLAG_CURVED_BOX and feeds a new monotone `endptPctMax` term in
  `curveSlack()`; `haystackSlack()` (radiusMax × node half) is the
  bound the *straight*-stream cull tests will grow by in the renderer
  item.  Haystack styling also suppresses arrows at the style layer
  (v3 draws none; stored-truth arrow getters read 'none' — recorded),
  and `refsInBox` tests haystack offset points (v3's haystackPts).
  Readback: `curve-style`/`haystack-radius` off the styled record;
  endpoints as canonical strings (keywords, 'x y' with % suffixes,
  '<rad>rad' angles); distances as numbers.  21 Node specs
  (`test/gpu-curve-12c-derivation.mjs`); two 12b-era specs updated to
  the new surface (haystack/edge-distances no longer throw).  1831
  Node tests, typecheck + lint green.
- [x] **Accessors + exact bb** (2026-07-30).  Haystack edges answer
  `sourceEndpoint()`/`targetEndpoint()` with their offset points
  (v3's haystackPts), `midpoint()` with the offset-point average
  (v3's rs.mid), and `boundingBox()` with the exact offset-point
  span; endpoint-flagged route kinds flow through `curveRouteAt`
  automatically, so manual-endpoint edges answer every accessor —
  resolved endpoints, chord midpoints, the promoted bundled bezier's
  control point, distance shortens on taxi — off the shared route
  evaluator, and the exact lazy bb covers manual endpoints outside
  the chord with the usual epoch-memoized invalidation.
  `controlPoints()` returns undefined for the straight-with-endpoints
  chord (MULTI n = 0 — no controls, matching v3's straight surface).
  11 Node specs (`test/gpu-curve-12c-accessors.mjs`); 1842 Node
  tests, typecheck + lint green.
- [x] **Renderer: straight-stream kinds, endpoint WGSL twins, cull
  slack** (2026-07-31).  The straight edge shader restructured: paint
  columns (line color / opacity / line-style) moved to the *fragment*
  stage via flat instance fetch (the curved pipeline's split), freeing
  vertex slots for `edge.curveParams` + `node.outerHalf` +
  `node.shape` — 6 VS storage buffers + the visible list.  The VS
  branches on the straight-stream kinds: haystack offsets both
  endpoints by (cos/sin(angle) · outerHalf · radius) from live
  positions (drags follow on-GPU), and straight-triangle computes
  boundary endpoints and tapers the half-width to zero at the apex
  (the FS's varying half-width keeps the AA exact; dashes skip
  triangle fills, v3's fill path; the pick FS inherits the taper, so
  picking matches the drawn triangle).  ROUTE_WGSL gained the
  endpoint-block twins (`rawEndptAnchorW`/`resolveEndptW`, the
  kind-flag strip, the n = 0 chord aims, and the
  `edge-distances: endpoints` frame rebase) — the label VS's route
  branch and the curved pick tile inherit them; route arrows now
  anchor at the route's *resolved* endpoint (q[0]/q[n+1] — for
  default modes exactly the old boundary point, for manual endpoints
  v3's arrowStart/End), aiming along the end tangent (the far
  endpoint for the n = 0 chord).  The edge-label VS anchors haystack
  owners at the offset midpoint with autorotate along the offset
  line.  The Frame uniform grew 48 → 64 bytes with `haystackSlack`
  (radiusMax × node half, monotone): the straight-edge cull and the
  edge-glyph cull grow their corridor/anchor tests by it, so haystack
  never culls wrong while staying decimated like any straight edge.
  4 new `webgpu` Playwright specs (haystack offset line + pick,
  triangle taper + taper-matched picking, manual endpoints off the
  chord + ≤ 64 B drag re-anchor, arrows at a shortened endpoint with
  the gap behind them) — 54/54 `webgpu`, 22/22 `webgpu-visual`
  (goldens byte-stable through the shader restructure, parity scenes
  0 px), 1842 Node tests, typecheck + lint green.
- [x] **Goldens, live v3 parity and the benchmark check**
  (2026-07-31).  Three new golden scenes — `haystack` (8 edges at
  radius 0.9; the id-hash angles make the scene deterministic across
  machines, which is what lets a haystack golden exist at all),
  `straight-triangle` (three orientations + an arrowed apex) and
  `manual-endpoints` (a px point source end, an angle target end, a
  source distance and an unbundled bezier under
  `edge-distances: endpoints`) — stable across repeat runs.  Three
  new **live v3-parity scenes**, all measuring **0 differing
  pixels** at 8 px strokes: `parity-endpoints` (the same endpoint
  config across orientations — v3's shorten matches v4's dist rule
  exactly at arrow gap 0), `parity-triangle`, and
  `parity-haystack0` — haystack at radius 0 pins the haystack
  *pipeline* against v3 exactly (both sides collapse to
  center-to-center lines); radius > 0 has no exact v3 parity by
  construction (v3 seeds with Math.random()), which the
  deterministic golden covers instead — the recorded deviation.
  Renderer benchmark re-run (same box, RX 580, dpr 2, scale 1):
  device p50s unchanged from the 12b record — straight gen-25k
  fit-all/zoomed/far 3.34/4.40/1.26 ms (was 3.3/4.4/1.2), curved
  8.61/3.81/6.30 ms (was 8.6/3.8/6.4) — the paint-to-FS restructure
  cost nothing measurable, and far-zoom haystack rides the straight
  stream's decimation by construction (the 12a revisit closed).
  Final tallies: 1842 Node + 60 module tests, 54/54 `webgpu` +
  28/28 `webgpu-visual` Playwright specs (3 new goldens, 3 new
  parity scenes), typecheck + lint clean.  **Round 12c is complete**
  — and with it the whole round-12 curved-edges plan.

## Landed (edge-label autorotate, 2026-07-29)

The last item on the autonomous shelf, cleared while planning round 12:
`text-rotation: autorotate` for edge labels, one isolated commit.

- **API**: `text-rotation` is an edge style prop — keywords `none`
  (default, horizontal) | `autorotate`, constants or mappers (enum
  kind, so `case` conditionals work, matching the other label
  channels).  Numeric rotations throw (per-element numeric
  `text-rotation` stays in the label-parity needs-a-call batch), and
  the prop throws on the nodes group (node labels don't rotate in v4).
  Readback follows the stored-truth rule: the sidecar entry when
  labelled, else the sheet.
- **The flip-rule call** (the one that was open): **v3's verbatim** —
  the label angle is the edge's *undirected* slope, v3's
  `atan(dy/dx)` (`labels.mts:95`), so the baseline stays within
  (−90°, 90°] and text never reads upside-down; vertical edges read
  top-to-bottom at +90° either direction.  The WGSL implements the
  same rule with no trig: it sign-normalizes the endpoint delta
  (negated when it points left, or straight up at dx = 0) and uses
  the unit vector as the rotation frame (`autorotateFrame`).
- **Mechanism**: rotation happens in the vertex shader from the live
  endpoint positions, so autorotate inherits the edge-label
  zero-rebuild property — drags, layouts and position tweens re-angle
  the label on-GPU (spec-pinned: making a vertical edge horizontal
  re-uploads ≤ 64 B, one position row).  The model bakes only a flag:
  bit 31 of the glyph instance's owner word (element slots stay far
  below 2³¹; the dead sentinel is the full-ones word, so no
  collision).  The background quad carries the flag too — a text box
  rotates with its text — and the edge-glyph cull kernel tests the
  exact rotated-rect AABB in the same rotation frame as the VS, so
  cull and draw can't disagree.  Node glyph paths are untouched, and
  the non-rotated edge path keeps its original arithmetic —
  pre-existing goldens pass unchanged.
- **Verification**: typecheck + lint clean; 1650 Node tests (5 new in
  `test/gpu-edge-labels.mjs`: entry + readback, defaults +
  sheet-resolution, throws for numbers/unknown keywords/nodes-group,
  case mappers, node-entries-never-rotate); 40/40 `webgpu` Playwright
  specs (new: a vertical-edge spec pinning the dark-pixel bounding box
  flipping from wide to tall under autorotate, plus the ≤ 64 B
  re-angle on an endpoint move); 13/13 `webgpu-visual` (new
  `edge-label-autorotate` golden: a downhill run, a direction-flipped
  uphill run with its background box rotated along, and a vertical
  top-to-bottom run — all pre-existing goldens unchanged).

## Landed (round 13 — style-prop parity, complete 2026-07-31)

Executed the round-13 plan below under the round-10 process rules.
Each item landed as isolated commits with docs in-commit; the records
below were written per item, in the same commits as the work.

- [x] **A1 Ghost props** (2026-07-31).  `ghost` ('yes' | 'no'),
  `ghost-offset-x/y`, `ghost-opacity` (validated [0, 1]; v3 defaults —
  a ghost is invisible until given opacity) — node-only, all four
  mapper-capable ('case' works for `ghost` as an enum).  The decided
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
  specs (`test/gpu-ghost.mjs`), a `webgpu` spec (ghost at the offset,
  not pickable, follows drags on-GPU, old spot clears), a `ghost`
  golden (three shapes with borders at one offset), and a
  `parity-ghost` live v3 scene — 0.945% mismatch (AA-classification
  seams only; for label-free nodes v3's whole-node ghost redraw *is*
  the body duplicate, so the scenes are directly comparable).  1850
  Node tests, 55 `webgpu` + 30 `webgpu-visual` specs, typecheck + lint
  green.

- [x] **A2 (nodes): overlay/underlay layers** (2026-07-31).  The 10
  `overlay-*`/`underlay-*` element props for **nodes** (edge layers
  are the next A2 slice): color/opacity/padding mapper-capable,
  shape (`round-rectangle` | `ellipse`) and corner-radius (number |
  `'auto'` — v3's min(w/4, h/4, 8), resolved in the shader from live
  extents) as constants; v3 defaults (opacity 0, padding 10).  Two
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
  draw).  Deviations, recorded: v4 overlays draw *under* the label
  layer (v3 draws overlay over its node's label); overlays are not
  pickable and box selection ignores their pads.  8 Node specs
  (`test/gpu-node-layers.mjs`), a `webgpu` spec (overlay wash +
  underlay ring), a `node-layers` golden, and a
  `parity-node-layers` live v3 scene at **0 px differing**.  1858
  Node tests, 56 `webgpu` + 32 `webgpu-visual` specs, typecheck +
  lint green.

- [x] **A2 (edges): overlay/underlay strokes** (2026-07-31).  The
  layer paint props (`overlay-color`/`-opacity`/`-padding` +
  underlay) now apply to **edges** too: the edge geometry re-stroked
  at width + 2 × padding (pre-derived at style-write into packed
  `Uint32Array×2` columns — [rgba folded, strokeWidth×256] — so the
  layer shaders need no width binding), the underlay under the
  edges, the overlay over edges + arrows, both under the nodes
  (v3's layering).  New `vsEdgeLayer`/`vsCurvedLayer` entry points
  ride the *existing* edge/curved visible lists with a VS collapse
  for disabled instances (no new cull kind; per-layer live counts
  gate the draws — zero cost when unused); the curved layer draw
  has its **own bind group layout** that omits the widths column —
  pipeline *layouts* count against the per-stage 8-storage-buffer
  limit even for bindings a shader never references, which the
  Playwright console-error guard caught as an invalid-pipeline
  cascade on the first cut.  Haystack offsets and the
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
  ⇒ screen-fixed rule).  A2 is now **complete** (nodes + edges +
  core).  4 Node specs (`test/gpu-core-style.mjs` — defaults,
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
  alphas alike (v3's parentOpacity).  Element `opacity` stays its own
  column multiplied in the FS, so v3's effective = channel × element
  holds; the arrow fold gains the line-opacity factor (v3's
  `effectiveArrowOpacity = opacity × lineOpacity`), threaded through
  `foldedArrow`, the kernel's constOpacity, and the edge-opacity
  tween's arrow targets.  All four are mapper-capable
  (CPU-evaluated).  GPU-eval interplay, the recorded scope note: a
  non-1 (or mapped) channel opacity **demotes that color channel's
  kernel eval to the CPU path** — the kernel would overwrite the
  folded bytes — via a `paintInputs` exclusion (a mapped line-opacity
  also demotes the arrow colors).  Early-z stays sound for free: the
  prepass already discards nodes whose stored fill alpha < 1.
  Readback is folded (stored alpha / 255 — the outline/arrow
  precedent), and a line-transparent edge reads its arrows as 'none'.
  7 Node specs (`test/gpu-opacity-split.mjs` — folds, mappers, the
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
  spot).  `corner-radius` (number | 'auto') feeds the
  round-rectangle SDF everywhere the radius appears — node FS, ghost
  FS, the depth prepass' interior test, and the CPU pick replica —
  with **'auto' now v3's min(w/4, h/4, 8)** (v4 had used
  min(w, h)/8; also closed).  The node/ghost quads, node cull and
  ghost cull grow by the border's outward extent (the ghost cull
  uses the full border width — the compute stage had no slot left
  for the position column; conservative only).  Both props are
  mapper-capable (enum/number, CPU — geometry tier: the pick reads
  them).  bb keeps the outerHalf center convention for all positions
  (v3's outerWidth does the same — recorded).  Caught by the guard
  en route: the first ghost-cull cut hit 9 compute storage buffers.
  4 goldens regenerated as the intended visual change
  (nodes-edges-arrows, polygon-shapes, selection-accent, ghost); a
  new `parity-border-geom` scene (three positions × explicit radii)
  measures **0 px differing**.  4 Node specs
  (`test/gpu-border-geom.mjs`) + the CPU-pick suite pinned to the
  new auto rule.  1873 Node tests, 93 Playwright specs, typecheck +
  lint green.

- [x] **B3 line-cap + dash patterns** (2026-07-31).
  `line-dash-pattern` (constants-only list, normalized to two on/off
  pairs — odd patterns double per canvas semantics, longer ones
  truncate, a recorded cap), `line-dash-offset` and `line-cap`
  (butt | round | square; cap + offset mapper-capable) land in two
  columns (`edge.dashPattern` f32×4, `edge.dashMeta` [offset, cap])
  bound fragment-side on both edge pipelines.  The dash mask became
  a proper 2D coverage: `dashInsideSd` (signed model-px distance
  inside the nearest on-segment, wrap-exact) + `dashCoverage` —
  butt is the plain product (pixel-identical to the old mask, so
  the pre-B3 goldens held), round is a capsule about the segment,
  square extends each dash by the half width.  Dashed edges use the
  per-edge pattern (v3); dotted stays [1, 1]; triangle fills ignore
  line-style (v3).  **A dash-phase deviation found and fixed**: v3
  launches the pattern at the *source boundary* while v4's straight
  edges measured u from the node center — the straight VS now
  subtracts the source boundary offset (haystack lines keep their
  offset-point origin, matching v3's haystackPts), taking the new
  `parity-dash-props` scene (pattern + offset + all three caps)
  from 2.501% to **0 px differing**.  Caught en route by the Node
  WGSL-identifier guard's runtime sibling: `meta` is a WGSL reserved
  word.  Line-end caps are dash-segment-only (quads don't extend
  past the endpoints; v3's default butt behaves identically) — a
  recorded deviation.  6 Node specs (`test/gpu-dash-props.mjs`);
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
  mapper-capable; zero-cost when unused (casingCount gating).  A
  kernel-owned element opacity would leave stale casing bytes, so an
  enabled (or mapped) casing demotes the `opacity` mapper to the CPU
  path — the B1 exclusion list extended.  `parity-casing` (straight
  + bezier pair + taxi under an 8 px casing) measures **0.061%** —
  the recorded butt-vs-round stroke-end deviation only.  5 Node
  specs (`test/gpu-edge-casing.mjs`).  1884 Node tests, 95
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
  binding left there); both bb scans grow by offset/2 + width.  All
  four props mapper-capable; readback folded/packed.  5 Node specs
  (`test/gpu-node-outline.mjs`); the B2/CPU-pick suites re-pinned
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
  (`test/gpu-label-box.mjs`).  1895 Node tests, 97 Playwright
  specs, typecheck + lint green.

- [x] **B7 arrow scalars** (2026-07-31).  `arrow-scale` (edge-wide,
  positive; quantized ×16 into the shapes word's top byte — quantized
  readback, recorded), `source/target-arrow-fill`
  (filled | hollow — flags at bits 16/17) and
  `source/target-arrow-width` (px | 'match-line' | %, resolved
  against the edge width at style-write into a new
  `edge.arrowWidths` column).  Both arrow shaders restructured:
  exact sizing moved to the **fragment stage** — the quad covers the
  frame's monotone `arrowScaleMax` (a Frame pad slot) and the FS
  renders the exact per-edge scale within it, which is what lets the
  curved arrow VS (whose 8 storage-buffer slots were all taken) stay
  untouched; hollow fills render as an `|sd|` ring at the per-end
  stroke width.  Scale/fill are mapper-capable; widths are constants
  (keyword/% forms).  **No pixel parity vs v3 by design**: v4 keeps
  its own linear arrow sizing (round-10 B4's recorded decision; v3
  uses max((13.37 w)^0.9, 29) with a 29-unit floor), so arrow sizes
  never coincide — the visual pins are the `arrow-scalars` golden
  (scale 2, hollow ends, thick hollow strokes) and a `webgpu`
  hollow-ring pixel spec.  6 Node specs
  (`test/gpu-arrow-scalars.mjs`).  1901 Node tests, 99 Playwright
  specs, typecheck + lint green.

- [x] **C1 mid-arrows** (2026-07-31).  `mid-source/mid-target-arrow-
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
  specs (`test/gpu-mid-arrows.mjs`).  1904 Node tests, 100 Playwright
  specs, typecheck + lint green.

- [x] **C2 gradients** (2026-07-31).  `background-fill`
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
  (`test/gpu-gradients.mjs`).  1910 Node tests, 102 Playwright specs,
  typecheck + lint green.

## Round 13 plan — style-prop parity (planned 2026-07-30; completed 2026-07-31 — see the round-13 Landed section above)

A prop-level sweep of the v3 style registry
(`src/style/properties.mts`: 280 registered props + 11 aliases)
against the v4 engine, asking one question per prop: is it
implementable **entirely under existing design decisions** — a new
channel column plus parse/mapper/stored-truth-readback plumbing plus
fragment-stage shader work, the pattern rounds 10 B2/B3/B4 (line
styles, label visuals, arrow shapes) established — with no new
subsystem and no open API-semantics call?  Roughly 55 props qualify;
they are this round.  The paint props are cheap for a structural
reason: colors/opacities fetch in the fragment stage (the
flat-instance-fetch precedent), so they never touch the
8-storage-buffer vertex budgets that constrain geometry work.  This
round refills the autonomous shelf; the design queue (compounds →
background images → event vocabulary/extension contract → force
layout) is not consumed by it.

- [x] **C3 custom polygons** (2026-07-31).  `shape: 'polygon'` +
  `shape-polygon-points` land on the round-11 blob pattern: a second
  `CurveBlob` pool holds each node's flat unit pairs, slot-stable
  compaction rewrites the packed offset|count<<24 ref that rides the
  `borderGeom` radius word (meaningless for polygons), and the
  column mirror ships the pool as one more growable buffer
  (`delta.polyBlob`).  The node FS gained `customPolySD` — iq's
  exact sdPolygon over the blob range scaled to device space, so AA,
  borders and the depth prepass's interior test stay crisp under
  anisotropy like the generated shapes — and CPU pick runs
  point-in-polygon over the same record: dual consumers of one ref,
  agreeing by construction.  Binding budget: the poly blob is the
  node stage's 9th storage buffer, so the node pipelines split into
  two layouts — main/prepass drop the ghost column (their entry
  points never read it), the ghost pipeline drops `node.flags` (no
  accent/hover on ghosts) — each landing at exactly 8 FS storage
  buffers; the ghost FS also gained the C2 gradient branch it was
  missing.  Points are constants-only, validated (even count, >= 3
  pairs, [-1, 1] range — v3's evenMultiple/min/max rules), capped
  at 32 points (recorded), default to v3's unit square, read back
  as the space-joined list, and free their pool record on
  non-polygon restyle and node removal.  WGSL lesson repeated:
  `ref` is a reserved word (caught by the console-error guard).
  Verification: 9 Node specs (`test/gpu-shape-polygon.mjs`: parse /
  readback / validation / blob refs / free-on-restyle / pick
  inside-ness incl. a pool-rewrite case), a `webgpu` spec (draw +
  pick agree on the point list at pixel level), the `shape-polygon`
  golden (concave arrow outline over bordered / anisotropic / small
  nodes), and **`parity-polygon` vs v3 at 0.005%** (6 px of AA on a
  shared concave-arrow scene — pure geometry, near pixel-exact).
  1919 Node tests, 106 Playwright specs, typecheck + lint green.

- [x] **D1 `font-style` + `font-weight`** (2026-07-31).  Both land
  as global constants riding the `font-family` rule: the store's
  face triple (`labelFont`/`labelFontStyle`/`labelFontWeight`) feeds
  the atlas's CSS font shorthand
  (`style weight ${SDF_FONT_SIZE}px family`), and any change marks
  every labelled slot dirty so the atlas reset and the glyph-run
  rebuild land in one pass — no new columns, no shader changes.
  Values: v3's sets (`normal | italic | oblique`; the weight
  keywords plus the numeric hundreds 100..900, read back as
  strings); edges-group use and mappers throw via the generalized
  `GLOBAL_FONT_PROPS` guard (same messages as `font-family`).  The
  playwright page gained the real Open Sans 700-italic `@font-face`
  so the D1 golden pins an actual face, not browser synthesis.  No
  v3 pixel parity for labels by recorded design (raster + placement
  differ) — the pins are the `labels-bold-italic` golden (label
  tolerance) and a `webgpu` spec asserting bold ink > normal ink in
  the label band plus a nonzero italic-vs-upright pixel diff.  7
  Node specs (`test/gpu-font-props.mjs`).  1926 Node tests, 108
  Playwright specs, typecheck + lint green.

- [x] **D2 `min-zoomed-font-size`** (2026-07-31).  Per-element, as
  planned: the prop rides the label sidecar (mapper-capable, both
  groups, v3's default 0 = no floor) and bakes into each glyph as a
  precomputed `zoomDprMin = minZoomed / fontSize` — the Glyph struct
  grew 12→14 words (56-byte stride, one f32 + explicit pad) — so
  both glyph cull kinds test `frame.zoomDpr < zoomDprMin` before the
  global `labelFadePx`/`labelMinPx` predicates: v3's
  `eleTextBiggerThanMin` (`fontSize × zoom × pxRatio < minSize` ⇒
  hide), evaluated on-GPU per glyph with zero per-frame CPU work,
  and the background quad hides with its text.  Fixed en route:
  `setLabel`'s no-op equality check learns the new field (a restyle
  changing only the floor previously kept the stale sidecar).  No
  label pixel parity vs v3 by recorded design — the pin is a
  `webgpu` LOD spec (floored + unfloored labels: both draw at zoom
  1, only the floored one vanishes at zoom 0.7, and it returns at
  zoom 1 — a pure cull, no rebuild) plus 4 Node specs
  (`test/gpu-min-zoomed-font-size.mjs`).  1930 Node tests, 109
  Playwright specs, typecheck + lint green.

- [x] **D3 `text-valign`/`text-halign`** (2026-07-31).  v3's 3×3
  node-label anchor grid, mapper-capable and node-only (the edges
  group throws, like v3 forcing edge labels to center/center).  The
  sidecar entry carries the node-extent base (`anchorX` =
  (halign−1)·w/2; `anchorY` per valign with the round-10 4 px
  label margin on the top/bottom rows) plus block-fraction shifts
  (halign −0.5/0/+0.5 of the laid width; valign −1/−0.5/0 of the
  laid height) that the glyph builder resolves once the run's real
  dimensions are known — placement only, no shader or cull changes,
  and the background box anchors with its text.  **Recorded
  deviation: v4's default `text-valign` stays `'bottom'`** (the
  round-10 below-node placement every existing golden pins); v3
  defaults to `'top'`.  The v3 `padding`-based gap is approximated
  by the fixed 4 px label margin (v4 has no `padding` prop).  No
  label pixel parity vs v3 by recorded design — pins are the
  `label-align` golden (all nine (halign, valign) pairs with
  background boxes) and a `webgpu` spec asserting ink moves
  above-left for top-left and below-right after a bottom-right
  restyle, with the opposite bands empty.  6 Node specs
  (`test/gpu-text-align.mjs`).  1936 Node tests, 111 Playwright
  specs, typecheck + lint green.

- [x] **D4 `source-label`/`target-label` families** (2026-07-31).
  All ten props land: `source/target-label` (constants or the
  `data(key)` passthrough, refreshing on data writes),
  `-text-offset` (non-negative, mapper-capable), `-text-margin-x/y`
  and `-text-rotation` (`none | autorotate`) — with the remaining
  text channels (font, color, boxes, opacity, transform,
  min-zoomed-font-size) shared with the main label, exactly v3's
  unprefixed reads.  Two more sidecar streams
  (`edgeSource`/`edgeTarget` in the widened `LabelStream` type) feed
  two more `GlyphBuffer`s from the same builder; the glyph word 13
  pad became the **endParam encoding** (sign picks the end,
  |v|−1 the arc offset — the +1 bias keeps offset 0 distinct from
  the midpoint streams).  The edge label VS re-anchors end glyphs by
  walking the drawn path — v3's `calculateEndProjection` on-GPU:
  straight/haystack segments exactly, bezier/loop as a 32-sample
  polyline of the quad chain (v3 itself walks a ~16-segment
  approximation), route families along the route polyline (v3's
  allpts walk — both ignore corner rounding) and multibezier at 8
  samples per quad chain link; autorotate takes the local tangent.
  The shared edge-glyph cull kind grows the viewport slack by half
  the chord for end glyphs (the anchor can sit anywhere on the
  path); two more `CulledGroup`s of the same kind and two more
  draws through the same `LabelPipeline` (its bind cache re-keyed
  per (uniform, stream)).  Edge removal and restyles clear the
  streams.  No label pixel parity vs v3 by recorded design — the
  pins are the `end-labels` golden (straight + bezier pair with
  autorotate + taxi + loop, boxed labels) and a `webgpu` spec
  asserting the straight-edge anchors land at v3's exact arc
  positions (boundary + offset) and slide on restyle.  8 Node specs
  (`test/gpu-end-labels.mjs`).  1944 Node tests, 113 Playwright
  specs, typecheck + lint green.  **Round 13 complete.**

**Sequencing**: pass 12c (the round-12 plan above) runs first, then
this round's phases in order — the 2026-07-29 triage keeps (ghost,
overlay/underlay) lead, per the discussion that produced this plan.
Process: the round-10 rules verbatim (isolated commits, docs
in-commit, full verify per item, escalation to "Needs a call" on any
real API-semantics question discovered mid-implementation; goldens
regenerated autonomously when a visual change is intended).

**Tier discipline** (the existing invariants, applied to the new
channels):

- Colors and opacities are *paint*: fragment-stage fetch, eligible
  for the GPU mapper eval kernel and paint tweens where the packing
  fits, always CPU-evaluable.
- Anything read by bb/fit, the CPU pick replica, or a columnar scan
  is *geometry*: eagerly CPU-evaluated, with its bounds/pick
  consumers extended in the same commit — `corner-radius` is read by
  the CPU pick inside-test; node `outline-width`/`-offset`,
  overlay/underlay padding and ghost offsets grow the store bb scan
  the way `border-width` already does.
- List props are constants-only (the 12b scope rule: a mapper value
  is one number/keyword, not a list), capped where they feed
  fixed-iteration shader loops, caps recorded as deviations.

**Implementation leans recorded at planning** (so the passes can run
autonomously):

- Gradients interpolate in **sRGB**, matching v3's canvas gradients —
  the live parity harness is the point of porting them.  (OKLab stays
  the default for *mapper* ranges; a gradient is a v3-parity visual,
  not a data encoding.)
- `font-style`/`font-weight` follow the `font-family` rule: global
  constants (one font per atlas); per-element forms stay out.
- Dashed `border-style`/`outline-style`/`text-border-style` stay out
  (dashing an SDF boundary needs perimeter parameterization — the
  recorded B2 reason); these props ship with `solid` semantics only
  where the rest of their group lands.
- `text-valign`/`text-halign` are placement only: labels stay
  excluded from `boundingBox()` (the recorded deviation), so the
  anchor grid carries no bb implications.
- Arrow scalars are draw-only in v4 (arrows are not pickable and not
  in bb — both existing recorded deviations), so `arrow-scale`/
  `arrow-width`/`arrow-fill` are pure FS/quad-sizing work.

**Phase A — the 2026-07-29 triage keeps** (direction already set)

- [x] **A1 Ghost props** (`ghost`, `ghost-offset-x/y`,
  `ghost-opacity`) — the decided simplified form: one extra instance
  draw of the basic node body (shape, border, background) at the
  offset, never labels or decorations.  Offsets grow the bb scan
  (geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **A2 Overlay/underlay theming** — the 10 `overlay-*`/
  `underlay-*` element props plus the `active-bg-*` and
  `selection-box-*` core props; the baked-in affordances (shader
  hover/active brighten, accent ring, DOM selection box) become the
  styled defaults.  Overlay/underlay padding grows bounds (geometry
  tier); underlay draws under the node within the existing pass
  order.  Landed 2026-07-31 in three slices — see the round-13
  record.

**Phase B — paint & stroke channels** (pure FS + channel plumbing)

- [x] **B1 Opacity split**: `background-opacity`, `border-opacity`,
  `line-opacity`, `text-opacity` — v3 semantics (element `opacity`
  is the master multiplier; effective = opacity × channel opacity).
  Early-z's guaranteed-opaque predicate consumes the product (more
  conservative, never wrong); text opacity folds into glyph alpha
  and reads back folded (the outline/background-opacity precedent).
  Landed 2026-07-31 — see the round-13 record.
- [x] **B2 `border-position`** (inside | center | outside — a pure
  SDF band offset) + **`corner-radius`** (a scalar channel feeding
  the existing round-rectangle SDF; CPU pick inside-test reads it —
  geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **B3 `line-cap`** (butt | round | square — endpoint cap SDF in
  the edge FS) + **`line-dash-pattern`/`line-dash-offset`**
  (arbitrary patterns over the existing arc-length varying;
  constants-only lists, pattern length capped).  Landed 2026-07-31 —
  see the round-13 record.
- [x] **B4 Edge casing**: `line-outline-width`/`-color` — a border
  band on the edge strip (straight and curved), colors fetched
  fragment-side.  Landed 2026-07-31 — see the round-13 record.
- [x] **B5 Node `outline-*`**: `outline-color`/`-opacity`/`-width`/
  `-offset` as an SDF band outside the shape (distance ∈
  [offset, offset + width]); solid only.  Bb scan and conservative
  bounds grow by offset + width; the pick body stays the shape
  itself (v3-consistent).  Landed 2026-07-31 — see the round-13
  record (the band derives as offset/2 past the border's outer
  edge, matching v3's scaled-path stroke exactly for circles).
- [x] **B6 Label box parity**: `text-transform` (none | uppercase |
  lowercase, applied when the glyph run is built),
  `text-border-width`/`-color`/`-opacity` (a border on the existing
  text-background quad), `text-background-shape` (rectangle |
  round-rectangle on the quad's SDF).  Landed 2026-07-31 — see the
  round-13 record.
- [x] **B7 Arrow scalars**: `arrow-scale`, `arrow-width`,
  `arrow-fill: hollow` (an FS ring test on the existing arrow SDFs).
  Compound arrow shapes stay out (recorded in round 10 B4).  Landed
  2026-07-31 — see the round-13 record.

**Phase C — re-triaged: 12a/12b built the machinery** (these sat in
needs-a-call batches; this plan's sign-off pulls them onto the
shelf, since the expensive part now exists)

- [x] **C1 Mid-arrows** (landed 2026-07-31 — see the round-13
  record): `mid-source-*`/`mid-target-*` arrow props —
  anchored at the curve/route midpoint with the midpoint tangent,
  exactly the anchor + frame edge labels and autorotate already
  compute in the VS (straight edges use the chord midpoint).  One
  more quad per enabled end off the edge cull streams.
- [x] **C2 Gradients** (landed 2026-07-31 — see the round-13
  record): `background-fill` (linear-gradient |
  radial-gradient) + `background-gradient-stop-colors`/
  `-stop-positions`/`-direction`; `line-fill` +
  `line-gradient-stop-colors`/`-stop-positions`.  Stop lists
  constants-only and capped (cap recorded); node FS evaluates along
  the gradient frame, edge FS along the arc-length varying; sRGB
  interpolation per the lean above.
- [x] **C3 `shape-polygon-points`** (landed 2026-07-31 — see the
  round-13 record) (custom polygon): the
  per-element unit point list lives in a blob (the curve-blob
  storage pattern, round-11 compaction rules), the node FS runs the
  generated sdPolygon loop over the blob range, and CPU pick runs
  point-in-polygon over the same points — dual consumers of one
  record, agreeing by construction.  Unit points are normalized, so
  the bb term stays the node box.

**Phase D — label props with recorded constraints**

- [x] **D1 `font-style` + `font-weight`** (landed 2026-07-31 — see
  the round-13 record) as global constants (the
  `font-family` rule: one font per atlas; a change resets the atlas
  and re-lays-out every label).
- [x] **D2 Per-element `min-zoomed-font-size`** (landed 2026-07-31 —
  see the round-13 record): a sidecar channel
  baked per glyph run, tested in the glyph cull predicate beside the
  global `labelFadePx`/`labelMinPx` (which stay the defaults).
- [x] **D3 `text-valign`/`text-halign`** (landed 2026-07-31 — see
  the round-13 record) for node labels: v3's 3×3
  anchor grid, anchor math off the node half-extents
  (`node.outerHalf` is already a bindable column); placement only
  per the lean above.
- [x] **D4 `source-label`/`target-label` families** (10 props;
  landed 2026-07-31 — see the round-13 record): two
  more glyph streams from the round-10 B5 template, anchored at
  v3's offsets along the edge (`source/target-text-offset` as arc
  distance via the route evaluator), each with its own margins and
  rotation per v3.  The chunkiest item — last for a reason.

**Excluded from this round, with reasons** (each stays in its parked
tier; none of these is newly decided): dashed
border/outline/text-border styles (perimeter parameterization);
`round-*` polygon variants, `cut-rectangle`, `barrel`,
`concave-hexagon`, `right-rhomboid`, `bottom-round-rectangle` (no
closed form under anisotropic scale — recorded in round 10 B1);
multiline props (`text-wrap`, `text-max-width`,
`text-justification`, `line-height`, `text-overflow-wrap`,
`text-metrics`, `box-select-labels` — their round designs label bb);
the `background-image` family (texture-atlas architecture call);
pie/stripe (wanted-at-all call); the compound group; `z-index` props
(coupled to the compaction draw-order call); `transition-*`
(animation-surface call); `display`/`visibility` split,
`events`/`text-events`, `box-selection: overlap` (interaction
calls); and everything in the dropped-by-decided-design ledger.

**Verification per item**: parse/readback/mapper Node specs; a
golden scene per visual group; live v3-parity scenes where the
visual is v3-comparable (gradients, casing, caps, mid-arrows, the
valign grid); the WGSL identifier/validation guards as usual.  The
renderer benchmark re-runs only for items touching hot paths (B1's
early-z predicate, C2's node-FS cost).

## Round 14 plan — compound nodes (planned 2026-07-31)

The head of the design queue: parent/child hierarchy, auto-sized
parent nodes, compound draw order, ancestor-gated visibility/opacity,
event bubbling, compound loop edges, and the compound
style/query/API surface.  Design discussed and signed off in one
sitting (2026-07-31); this section records the calls and the pass
split so the round can run under the round-10 process rules
(isolated commits, docs in-commit, full verify per item, escalation
on any new API-semantics question).  Two process amendments,
user-set for this round: **docs land first** (this plan section and
the README pointer are their own commit before any implementation),
and each item is **tests-first** — its specs are written and seen
red before the implementation brings them green, landing together as
the item's isolated commit so every commit on `v4` stays green.

**Signed-off design calls:**

1. **Parent styling takes both decided forms.**  (a) The sheet gains
   a **`parents` group** overlaying the nodes group for parent slots
   — constants or mappers, defaults = v3's `:parent` block
   (`shape: rectangle`, `padding: 10`, `background-color: #eee`,
   `border-width: 1`, `border-color: #ccc`).  (b) The `case`
   mapper's `when` gains **structural boolean conditions**
   (`{ parent: true }`, `{ child: true }`).  Query objects gain the
   matching `parent`/`child` boolean keys.  The v3 `:parent:selected`
   tint is dropped — v4 never restyles on selection (the shader
   accent ring is the selection affordance); recorded deviation.
2. **Event bubbling is ported** (reversing v4's flat-emit rule for
   compounds only): element events bubble child → ancestors → core
   with v3 semantics — `event.target` stays the originator,
   `stopPropagation()`/return-`false` halts the walk.  The flat
   no-compounds path stays byte-identical (zero cost).
3. **Pass-1 scope**: hierarchy + traversal API + `move({ parent })`
   + remove-cascade + auto-bounds with padding + parents-under-
   descendants draw order + parent drag moves subtree + parent
   labels, **plus** ancestor-gated visibility, rendered
   effectiveOpacity (ancestor product), compound loop edges, and
   `min-width`/`min-height` as a **simplified centered clamp** —
   the four bias props (`min-width-bias-left/right`,
   `min-height-bias-top/bottom`) are dropped by decided design
   (their px-reinterpreted-as-percent rule and ratio normalization
   don't earn their surface; the centered clamp is exactly v3's
   default-bias behavior).  **Future-round note (user-set): revisit
   asymmetric parent spacing with a cleaner mechanism — e.g. four
   per-side padding props — rather than resurrecting the biases.**
4. **Dropped/recorded**: `z-compound-depth`/`z-index-compare` (the
   z-index round); `compound-sizing-wrt-labels: 'include'` throws
   (labels are excluded from bb in v4 — the prop parses,
   `'exclude'` is the only accepted value); the bias props and
   `:parent:selected` (above).

**Global decisions:**

- **Flag bits** (`contract.mts`; 4096+ free): `FLAG_PARENT = 4096`
  (has ≥1 child), `FLAG_CHILD = 8192` (has a parent),
  `FLAG_SELF_HIDDEN = 16384` (own display state).  **`FLAG_VISIBLE`
  is redefined as the *effective* shown bit** (own state AND no
  hidden ancestor) — every consumer (WGSL `SHOWN`, the cull
  predicates, `scanRefsInto`, `boundingBox`, CPU pick, and the edge
  kernels' both-endpoints-SHOWN tests) already reads it, so
  ancestor gating and edge gating land with zero shader or scan
  changes.  Store-managed derived bits follow the `FLAG_CURVED`
  precedent.
- **Parent geometry is materialized into the real
  `node.size`/`node.position` columns** by a lazy pull-based flush
  (the CurveIndex pattern), so bb, cull, pick, `refsInBox`, the
  mirror and all shaders need zero geometry changes.
  `GraphStore.flushDerived()` = `hierarchy.flush()` then
  `curves.flush()`, replacing every `curves.flush()` call site —
  hierarchy first, because curve derivation (loops, compound loops,
  endpoint math) reads the sizes/positions the hierarchy flush
  writes.
- Verified at planning: no `StyleEngine.dependsOnSelection` exists
  at HEAD (it left with the selector removal) — the parent-flip
  restyle hook is built fresh; and v3 edge `effectiveOpacity` is the
  edge's own opacity (edges have no parent), which v4 ports.

**Design (per subsystem):**

- **HierarchyIndex** (`store/hierarchy.mts`, new; modeled on
  `store/curve-index.mts` — host-callback object, pending sets,
  `flush()`).  State: `parent: Int32Array` (−1 = orphan) +
  `parentGen` (recycle safety; mismatch ⇒ orphan + warn-once),
  `children: Map<slot, slot[]>`, `depth: Uint16Array`,
  per-parent CPU style inputs (`padding`, unit, `relativeTo`,
  `minW/H`, fallback size), `baseOpacity` (pre-fold), resolved
  padding cache, `pendingParents`, `parentCount`, `orderDirty`.
  `setParent` cycle-guards by ancestor walk (cycle ⇒ warn + no-op,
  v3), maintains children/depth/flags, marks old+new chains
  pending, invalidates the subtree's incident edges in the
  CurveIndex, and fires the style flip + structural-case refresh
  hooks.  `flush()` expands pending to ancestors, sorts
  **depth-descending** (children-before-parents replaces
  recursion), computes direct-children bb from raw columns
  (skipping effectively hidden children), applies padding (px or %
  of children-bb w/h/average/min/max), the min-size centered
  clamp, and the degenerate-children fallback (stylesheet size at
  the stored position), then writes through `materializeGeom` —
  raw column writes + dirty marks + `updateOuterHalf` +
  `geoEpoch++` + label re-anchor when size changed + incident-edge
  curve invalidation.  `materializeGeom` **bypasses
  `setPosition`**, so no child shift and no re-marking: flush
  cannot re-enter itself.
- **Parent `setPosition`** (public path): shift all descendants by
  the delta via raw writes (locked children move too — v3), write
  the parent, mark only its *ancestors* pending (uniform subtree
  translation keeps its own derived center exact).  The bulk
  position writers and `shift`/`positions` gain v3's dedupe rule:
  skip elements whose ancestor is also in the written set.
- **Flush triggers**: the four position writers (slots with
  `FLAG_CHILD`), size/border writes (beside the `updateOuterHalf`
  hooks), add/remove/reparent, compound style writes, visibility
  toggles.  Drained from `flushDerived()` at `takeDelta` (before
  mirror sync), `boundingBox`, `refsInBox`, the collection bb
  sites, and the pick entry.
- **GPU tween demotion**: a position animation whose slots include
  any `FLAG_CHILD`/`FLAG_PARENT` node is not GPU-eligible (a GPU
  lease leaves CPU positions stale ⇒ stale auto-bounds; a tweened
  parent must shift children per tick).  Reparenting while a GPU
  position tween is live settles all active GPU position tweens to
  the CPU (rare structural op; recorded).
- **Draw order / cull / pick**: a new `parentNode` cull kind whose
  input iteration is a CPU-maintained permutation (`parentOrder`,
  parents sorted by (depth asc, slot asc), rebuilt on hierarchy
  change — compaction preserves input order, so parents paint
  shallow-under-deep); bindings positions + outerHalf + flags +
  parentOrder (+3 outputs) = 7/8.  The existing `node` cull
  predicate excludes `FLAG_PARENT` (flags already bound), which
  also removes parents from the **depth prepass** — mandatory,
  since a prepass-written parent interior would early-z-kill the
  edges/children that must draw over it (parents lose the early-z
  benefit; recorded — they are few and flat).  `drawScene` draws
  parent bodies right after the prepass, before edge underlays,
  reusing the main node pipeline.  Parent
  ghost/underlay/overlay/label bands keep their existing post-edge
  positions — recorded z deviations deferred to the z-index round.
  CPU pick becomes two passes mirroring draw order: leaves
  descending (skip `FLAG_PARENT`), then parents in reverse
  `parentOrder`, with a shared order helper so pick and draw can't
  diverge.  Dragging a parent needs no drag-set union (parent
  `setPosition` shifts the subtree); `FLAG_GRABBED` is not set on
  descendants (minor recorded deviation).
- **Visibility + opacity folds**: `setVisibility` sets/clears
  `FLAG_SELF_HIDDEN` and recomputes effective `FLAG_VISIBLE` over
  affected subtrees (pruned walk), marking parents pending (hidden
  children leave the bb).  `visible()` reads the effective bit;
  the display readback reads `!FLAG_SELF_HIDDEN`.  `node.opacity`
  stores the **effective** value (`base × ∏ ancestor bases` — the
  round-13 B1 fold pattern, with the base tracked CPU-side); a
  parent's opacity write refolds its subtree, gated on
  `parentCount > 0` so the non-compound path is unchanged.
  `style('opacity')` reads the base; `effectiveOpacity()` the fold.
  GPU-mapped node `opacity` (and `width`/`height`) demote to CPU
  while compounds exist (the kernel would overwrite the fold;
  auto-size owns parent sizes).
- **Bubbling**: phase-based fan-out in `core._emitOnEle` — flat
  mode (no compounds, or orphan/edge target) is exactly today's
  single emit; phased mode emits per chain element child →
  ancestors → core, checking `isPropagationStopped()` between
  phases (the shared emitter's existing machinery).  Ref-qualified
  listeners match the phase ref; predicates run against the phase
  element; unqualified listeners match only the core phase (still
  fire exactly once).  `callbackContext` returns the phase element
  (v3's currentTarget); `event.target` stays the originator.
- **Style/query**: `SHEET_KEYS` gains `'parents'`; the block takes
  node props plus `padding`, `padding-relative-to`, `min-width`,
  `min-height`, `compound-sizing-wrt-labels`.  The engine holds a
  second computed-const record (nodes overlaid with the parents
  block); apply picks by `FLAG_PARENT`; parent `width`/`height`
  divert to the fallback size (auto-bounds owns `node.size`).  The
  parent-flip hook re-applies the flipped slot's constants,
  re-bakes its label entry, transfers width/height ownership both
  ways, and refreshes structural case deps (pseudo-keys
  `'::parent'`/`'::child'` in the deps map).  Matcher: `parent`/
  `child` boolean keys OR-composed into the flag test like
  `selected`; `group: 'edges'` + a structural key throws.  Any
  channel where the parent overlay differs while GPU-mapped
  demotes to CPU.
- **Compound loop edges**: the CurveIndex host gains
  `relation(a, b)` from the hierarchy; ancestor/descendant edges
  (and parent self-loops) derive a `CURVE_MULTI`-family blob
  record with v3's `findCompoundLoopPoints` math verbatim (two
  control points off the min top-left corner, `loopW = 50`,
  per-end stretch `max(0.5, log(w·C))`), box-bounded
  (`FLAG_CURVED_BOX`).  Applies regardless of declared curve style
  (v4 has no `edge:compound` selector — mirrors the forced
  self-loop rule; recorded).  Re-derives on reparent and on
  endpoint resize during hierarchy flush.
- **Model/API/format**: `parent` becomes a reserved first-class
  key — skipped by def/columnar data ingest, immutable via
  `data()` (reparent via `move()`), synthesized on read like edge
  `source`/`target`.  Def ingest resolves `parent` in a second
  pass after the batch's nodes exist (forward refs OK; unknown
  parent ⇒ warn + orphan, v3).  Wire format: version bump +
  optional nodes parent section (u32 index, sentinel);
  `GpuColumnarNodes.parent?`.  Collection: the full traversal
  surface (slot-native), `remove()` cascade over descendants,
  identity-preserving `move({ parent })` with `moveout`/`move`,
  compound-relative `relativePosition`, real `padding()`, and
  **parent `width()` readback subtracts 2·padding** (the column
  stores the padded/drawn size; `paddedWidth()` returns the
  column) — v3 parity.  `cy.hasCompoundNodes()` goes live.
  Layouts position non-parents only; `boundingBoxAt`
  force-derives.

**Pass split** (tests-first per item; each lands green as its own
commit(s) with docs in-commit):

- [x] **14.0 Docs-first** — this plan section + the README pointer
  (landed as its own commit before any implementation, per the
  user-set process amendment).
- [x] **14.1 Hierarchy model** — landed 2026-07-31.
  `FLAG_PARENT`/`FLAG_CHILD` (contract bits 4096/8192, node-only,
  store-managed like `FLAG_CURVED`); `store/hierarchy.mts` — the
  `HierarchyIndex` (host-callback object like the CurveIndex):
  `parent: Int32Array` (−1 = orphan) + link-time `parentGen`
  (recycle guard, warn-once), sparse `children` lists, `depth`,
  live-parent count, and the lazily-rebuilt `parentOrder()`
  (depth-asc, slot-asc) draw permutation.  `setParent` cycle-guards
  by ancestor walk (warn + no-op, v3's dropped-ref rule), maintains
  flags/depths (subtree walk on reparent) and no-ops on same-parent
  writes; `removeNode` now throws while children remain (the 14.2
  collection cascade removes them first) and severs the node's own
  link.  Store delegates (`setParent`/`parentOf`/`childrenOf`/
  `depthOf`/`isAncestorOf`/`parentCount`/`hasCompounds`/
  `parentOrder`); `cy.hasCompoundNodes()` is live.  The `parent`
  data key is **reserved first-class**: def ingest skips it (14.2
  resolves it as hierarchy), `data('parent', v)` throws (reparent
  is `move()`), and reads synthesize from the hierarchy like edge
  `source`/`target` (whole-object `data()` includes `parent` only
  when parented).  Tests-first: 12 specs in
  `test/gpu-hierarchy.mjs` written red, then green — 1956 Node
  tests, typecheck + lint clean.
- [x] **14.2 Collection API + lifecycle** — landed 2026-07-31.
  Slot-native traversal on the hierarchy: `parent` (always a proper
  collection — v3's raw-ref single-element shortcut and its
  ignored-selector wart are not ported), `parents`/`ancestors`
  (level-by-level, nearest first), `children` (link order),
  `descendants` (pre-order), `siblings` (via
  parent().children() − self; orphans are nobody's siblings),
  `orphans`/`nonorphans` (filters of the calling collection),
  `commonAncestors` (closest first; an edge member empties the
  result, v3), and the `isParent`/`isChildless`/`isChild`/
  `isOrphan` predicates (booleans, first-element semantics).
  Lifecycle: `remove()` cascades over descendants + their incident
  edges (packed-seen closure; nodes removed depth-descending so the
  store's children-first rule always holds); `move({ parent })`
  re-parents in place — identity preserved, `moveout` before /
  `move` after per changed node (listener-gated), unknown parent a
  silent no-op (v3), cyclic assignment warns + drops with no
  events; def ingest resolves `data.parent` in a second pass after
  the batch's nodes exist (forward refs in any order; numeric
  parents coerce to string ids; unknown/non-node parents warn +
  orphan — v3's silent-drop case upgraded to a warning); element
  `json()` carries `parent` via the synthesized data object and
  round-trips through `add()`.  Tests-first: 17 specs in
  `test/gpu-compounds-api.mjs` red then green — 1973 Node tests,
  typecheck + lint clean.
- [x] **14.3 Auto-bounds flush** — landed 2026-07-31.  Parent
  geometry is derived lazily and **materialized into the real
  `node.position`/`node.size` columns**, so bb/cull/pick/mirror
  need zero geometry changes.  `HierarchyIndex` gained the pending
  set (`markGeo` marks whole ancestor chains with early-exit;
  `markAncestors` for pure translations), per-parent compound
  style (`setCompoundStyle`: padding px/% + relative-to, min-w/h),
  and `flush()`: deepest-first over pending parents, direct
  children's border-inclusive extents off `node.outerHalf`
  (hidden children excluded — v3's display:none bb rule),
  % padding against the pre-clamp children bb (v3), the centered
  min clamp, and the degenerate fallback to the **stashed style
  size** at the stored position.  The stored size is the
  padded/drawn box: `width()`/`height()` readback subtracts
  2·padding (v3's autoWidth), `paddedWidth`/`paddedHeight` return
  the column, `outerWidth` = padded + border, `padding()` answers
  the resolved pad.  Writes go through `materializeParentGeom` —
  dirty spans, `updateOuterHalf`, the `nodeHalfMax` cull meter,
  `geoEpoch`, and a store-side **label re-anchor** (the sidecar
  entry's halign/valign reconstruct from its block-fraction
  shifts, so no engine round-trip) — and never re-mark: the flush
  can not re-trigger itself (spec-pinned).
  `GraphStore.flushDerived()` = hierarchy then curves, replacing
  every `curves.flush()` site; drains at takeDelta/bb/refsInBox/
  accessors.  Triggers: the four position writers (a parent
  `setPosition` flushes, then shifts its subtree by the delta —
  v3's beforePositionSet — with locked children moving too; bulk
  writers take per-slot sequential semantics under compounds),
  size/border writes (`markGeo`; a style size write on a parent
  also refreshes the stashed fallback), add/remove/reparent, and
  show/hide (hidden children leave the bb).  Collection:
  `shift()` gains v3's ancestor-in-set dedupe; parent moves emit
  `position` for shifted descendants (listener-gated, v3);
  compound-relative `relativePosition` (get + both setter forms);
  parent-flip restores the stashed style size.  Tests-first: 14
  specs in `test/gpu-compound-bounds.mjs` red then green (two
  real bugs caught red-green: the parent-move delta and the bulk
  shift both read pre-flush positions — both now flush first) —
  1987 Node tests, typecheck + lint clean.
- [x] **14.4 Ancestor visibility + effective opacity** — landed
  2026-07-31.  `FLAG_SELF_HIDDEN` (16384) records the element's
  own show/hide state; **`FLAG_VISIBLE` is now the effective shown
  bit** (own state AND no hidden ancestor) recomputed by
  `GraphStore.setVisibility` over affected subtrees with pruning
  (an unchanged effective bit means a consistent subtree) — every
  consumer (WGSL SHOWN, cull, scans, bb, CPU pick) reads the one
  bit unchanged, changed nodes mark their chains' auto-bounds
  stale, reparenting re-resolves the moved subtree, and a child's
  own hidden state survives parent toggles (v3).  `refsInBox`
  gained the drawn-edge rule (both endpoints shown — closing a
  pre-existing gap where a hidden endpoint's edges stayed
  box-selectable).  Effective opacity renders: the node opacity
  column stores `base × ∏ ancestor bases` (bases tracked sparsely;
  writes fold at setScalar, a parent's write refolds its subtree,
  reparenting refolds against the new chain, recycled slots
  drop their state), `style('opacity')` reads the base while
  `effectiveOpacity()`/`transparent()` read the fold, edges keep
  their own opacity (v3 — verified against v3 source), and a
  GPU-mapped node `opacity` demotes to CPU while compounds exist
  (`paintInputs` + a store→engine `onCompoundsToggled` paintVersion
  bump on the 0↔>0 transitions).  Tests-first: 11 specs in
  `test/gpu-compound-visibility.mjs` red then green — 1998 Node
  tests, typecheck + lint clean.
- [x] **14.5 Event bubbling** — landed 2026-07-31.  Element events
  on parented nodes now run in **phases** — origin → ancestors
  (child→parent) → core — implemented as `_emitOnEle` re-emitting
  **one shared Event** with a moving `_gpuPhaseRef`, so
  `stopPropagation()` (or return-`false`) carries between phases
  and halts the walk (v3).  Per phase: ref-qualified element
  listeners fire in their own element's phase with the callback
  context set to that element (v3's currentTarget) while
  `event.target` stays the originator; unqualified core listeners
  fire once, in the core phase; predicate listeners keep v3
  delegation semantics — once, against the originator, at the core
  (verified against v3's core-selector delegation, which also
  matches the target once).  Flat emits (no compounds,
  orphan/edge targets) never stamp the phase fields and take
  exactly the old single-emit path — byte-identical behavior and
  zero cost.  Within-phase order stays registration order (the
  recorded deviation narrows to within-phase only).  Tests-first:
  9 specs in `test/gpu-compound-events.mjs` red then green — 2007
  Node tests, typecheck + lint clean.
- [x] **14.6 Parents sheet group + compound props** — landed
  2026-07-31.  The sheet gains **`parents`**: channel props that
  overlay the nodes group for parent slots with v3's order-based
  precedence — the default `:parent` overlay (rectangle, #eee
  fill, 1px #ccc border) < user nodes block < user parents block
  (v3 applies blocks in order; the 14.9 parity scene caught the
  first cut assuming specificity ordering) — plus the
  compound props (`padding` px or 'N%', `padding-relative-to`,
  `min-width`/`min-height`, `compound-sizing-wrt-labels` where
  `'exclude'` is the only accepted value, `'include'` throws —
  labels are excluded from bb; compound props are constants-only
  and throw outside the parents group).  Padding defaults to v3's
  10.  Engine mechanics: a third GroupDef compiled from the merged
  props (parents-block mappers evaluate for parent slots only);
  `applyBulk`/`refreshMapped` partition node slots by
  `FLAG_PARENT`; mapper escalations re-partition via
  `allSlotsFor`; the readback paths route through `defFor(ref)`;
  `stylesDependOnData` consults the parents deps;
  `store.setCompoundStyle` lands per parent at apply.
  **Flip restyle**: a leaf↔parent flip re-applies the slot against
  the right group via a store `onParentFlip` hook (defaults differ,
  so flips always visibly restyle — v3); parent style width/height
  keep flowing into the stashed fallback (the 14.3 ownership
  rule).  **GPU demotion**: channels the parents overlay resolves
  differently (the default overlay's background/border colors, any
  user parents-block prop) demote a nodes-group GPU mapper to the
  CPU path while compounds exist — the kernel evaluates every
  slot and would repaint parents with the nodes value.  Readback:
  compound props answer from the per-parent record (leaves read
  the zero defaults).  Tests-first: 9 specs in
  `test/gpu-parents-style.mjs` red then green; the 14.3 bounds
  suite pins raw math by zeroing the new defaults in its sheet —
  2016 Node tests, typecheck + lint clean.
- [x] **14.7 Structural query + case keys** — landed 2026-07-31.
  Query objects gain **`parent`/`child` booleans** (`parent: false`
  = v3's `:childless`, `child: false` = `:orphan`), OR-composed
  into the one flag test like `selected` — pure columnar scans, no
  `scanRefsInto` changes.  Structural keys are node concepts: an
  explicitly-edges query throws, an unrestricted one just never
  matches edges (v3's pseudo semantics).  The `case` mapper's
  `when` gains the structural forms `{ parent: bool }` /
  `{ child: bool }` — a structural condition stands alone (AND it
  with data conditions via the `when` array form) and compiles to
  the reserved `'::parent'`/`'::child'` keys the engine's value
  reader answers from the hierarchy flags, so deps registration,
  evaluation and refresh all reuse the data-condition machinery
  verbatim.  A reparent fires a pseudo-key `refreshMapped` on the
  moved node (`store.onReparented`); parent flips already restyle
  fully via 14.6's hook.  Tests-first: 8 specs in
  `test/gpu-structural-query.mjs` red then green — 2024 Node
  tests, typecheck + lint clean.
- [x] **14.8 Wire + columnar parent sections** — landed 2026-07-31.
  `GpuColumnarNodes.parent?: Uint32Array` — payload node indices,
  `NO_PARENT` (0xffffffff) sentinel — with `toColumnarElements`
  lifting def parents into it (unknown in-payload parents warn +
  orphan; the parent key never lands in the data columns), bulk
  store ingest linking after the flags fill (out-of-range indices
  throw the self-contained rule; cycles ride the setParent guard —
  the first payload link holds, the closing link warns + drops),
  and the wire format gaining the node-parent section (flag 512,
  written right after positions).  Wire **version bumps to 3**;
  the reader accepts 2–3 (a v2 buffer can never carry the parent
  flag, so old payloads load unchanged — spec-pinned by
  re-stamping a compound-free v3 buffer as v2).  `cy.serialize()`
  flushes derived geometry and exports the live hierarchy as
  payload indices (second pass — a parent may sit later in slot
  order than its children), round-tripping selection + positions +
  parents.  Tests-first: 7 specs in `test/gpu-compound-wire.mjs`
  red then green — 2031 Node + 60 module tests, typecheck + lint
  clean.
- [x] **14.9 Parent draw stream, cull, pick** — landed 2026-07-31.
  Parent bodies draw in their own stream right after the depth
  prepass (under every edge layer — v3's compound order), off a
  new `parentNode` cull kind whose input iteration is the
  CPU-built (depth asc, slot asc) permutation: the compaction
  scaffold's write expression is now parameterizable, and the
  parent kernel writes the *permuted* slot, so its visible list is
  already in paint order (outer parents under inner ones) with
  zero sorting on-GPU.  Bindings: positions/sizes/flags/
  borderWidths + the parentOrder buffer (uploaded only when the
  hierarchy's order object changes identity) at exactly the
  8-storage budget, with the ghost cull's conservative extent tier
  (full border + the frame outline slack).  The main `node` cull
  (and with it the depth prepass) excludes `FLAG_PARENT` — flags
  were already bound, zero new bindings — which is also what keeps
  early-z from killing the edges/children that draw over parent
  interiors (parents lose the early-z benefit; recorded — few and
  flat).  CPU pick became two passes mirroring draw order: leaves
  descending, then parents in reverse permutation (deepest wins),
  so a parent can never swallow its children's picks; the pick
  entry and export/serialize paths flush derived geometry first.
  **Two real bugs caught by the new harness**: the renderer's
  init-time mirror full-upload ran before the hierarchy flush
  (the exact 12a init-order lesson re-hit — parents rendered at
  their pre-derive columns; init now calls `flushDerived()`), and
  14.6's specificity assumption was wrong — **v3 precedence is
  order-based**, so a user nodes block overrides the default
  `:parent` overlay (the parity scene showed v3 parents in the
  user node color; the merge order and GPU-demotion set were
  corrected, with the parents-style suite re-pinned).  Verifies:
  3 new compound CPU-pick specs, a `webgpu` behavioral spec
  (child-over-parent pixels, padding band, edge-over-parent, pick
  in band vs child, parent follows child), the `compounds` golden
  (nesting/padding/borders), and the `parity-compounds` live v3
  scene at **2.09%** under a 3% bound — the residual is a
  recorded deviation: v3's node bb includes the border's
  miter-corner overshoot (~(√2−1)·border/2 per side on cornered
  shapes), which compounds inherit as slightly larger parent
  boxes with bordered children; v4's child extents are the plain
  border-inclusive `outerHalf`.  Full suites: 2034 Node tests,
  116/116 Playwright (54+3 `webgpu`... all pre-existing goldens
  byte-stable), typecheck + lint clean.
- [x] **14.10 Compound loop edges** — landed 2026-07-31.  An edge
  between a node and its own ancestor/descendant (or a self-loop
  on a parent) routes around the outside — v3's
  `findCompoundLoopPoints` verbatim (two controls off the
  endpoints' min top-left corner, `(1 + 50^1.12/100)·dist·(j/3+1)`
  offsets, stretch `max(0.5, ln(outerWidth·0.01))` per end) — as a
  new **`CURVE_CMPD` kind** rendered exactly like a loop (two C1
  quadratics through the control midpoint) with control points
  evaluated from **live** positions/outer halves in both
  implementations, so drags and auto-bounds resizes follow with
  zero re-derivation.  Routing applies whatever the declared curve
  style (v3's `edge:compound` default block makes related edges
  bezier-compound by default, so behavior matches; unbundled
  styles take `control-point-distances[0]` and j = 0 — v3).
  Derivation rides the CurveIndex: a relation is a pair-map build
  trigger (bundle indices), reparenting invalidates the moved
  subtree's incident edges, leaf↔parent flips re-route self-loops,
  and `flush()` loops until settled (a per-edge derivation that
  discovers a relation hands its pair back).  Cull: box-bounded
  (`FLAG_CURVED_BOX`) plus a derivation-time excursion bound in
  `curveSlack` (2× stretch margin — stretch grows only
  logarithmically with node size; parent resizes refresh the
  bound; recorded).  **Two kind-space traps found**: the WGSL
  analytic-vs-route dispatch (`params.w <= 2.0`) sent the new kind
  into the blob-route path — six dispatch sites now special-case
  it (the first golden run caught taxi-like garbage) — and
  `CURVE_HAS_ENDPT = 8` collided with the naïve next kind id, so
  `CURVE_CMPD = 16` sits above the endpoint-flag range with a
  contract note (raw-kind tests only, before any strip).
  Verifies: 9 Node specs (`test/gpu-compound-loop-edges.mjs`,
  v3-formula control points, relation lifecycle, slack/flags,
  live resize), the `compound-loops` golden, and
  `parity-compound-loops` live vs v3 at **0.022%** (the
  outside-to-line vs outside-to-node endpoint difference is
  invisible at this scale).  2043 Node tests, 118/118 Playwright,
  typecheck + lint clean.
- [x] **14.11 Interaction + tween demotion + layouts** — landed
  2026-07-31.  **Layouts position leaves only** (v3):
  `layoutPositions` filters parents (auto-bounds derive them from
  their placed leaves), the grid slot path filters `FLAG_PARENT`
  slots, the grid handle path / circle / concentric / breadthfirst
  filter their node lists, and preset skips parent entries in both
  forms (a preset parent write would shift its whole subtree).
  `boundingBoxAt` skips parent bodies — the leaves' hypothetical
  boxes stand in; the padding margin is not modeled (a recorded
  fit-target approximation).  **GPU tween demotion**: a position
  animation whose node targets carry `FLAG_PARENT|FLAG_CHILD` is
  not GPU-eligible (a lease would leave the CPU columns the
  auto-bounds derivation reads stale, and a tweened parent must
  shift its subtree per tick — CPU-only semantics); unrelated
  leaves in compound graphs stay eligible.  **Reparent settle**:
  `AnimationManager.settleGpuAll()` (factored from detachDriver)
  runs from the store's reparent hook, so live leases settle to
  the CPU before the moved slots fall under CPU-side derivations.
  **Interaction needed no pointer changes**: a parent drag is just
  `position()` (the 14.3 subtree shift), and drag-all-selected
  with a parent + its child rides the collection `shift()` dedupe.
  Tests: 6 Node specs (`test/gpu-compound-layouts.mjs`) + a
  Playwright drag spec (parent-band drag moves the subtree by the
  pointer delta; a selected parent+child pair moves exactly once).
  2049 Node tests, 119/119 Playwright, typecheck + lint clean.
- [x] **14.12 Debug scene + benchmarks + true-up** — landed
  2026-07-31.  `debug/webgpu` gained a `?network=compound`
  generated scene (clustered leaves under ~N/20 parents, every 4th
  parent nested, intra-cluster edges plus a sprinkle of
  child→parent compound loops).  **`benchmark/gpu/compound.mjs`**
  (Mitata, v3 vs v4 at BENCH_N; instances torn down after the run —
  v3 compound instances leave live timers behind): at N = 2k,
  parent drag (subtree shift + bb settle) **263×** v3 (1.14 µs),
  child drag + parent re-derive **59×** (1.50 µs), reparent
  round-trip **142×** (0.64 µs).  **Flush cost at scale** (200k
  leaves under 1 000 parents, 200 children each, 200k edges;
  direct measurement): init 1.81 s, a full re-derive of all 1 000
  parents **2.7 ms**, a parent-drag frame (200-child subtree shift
  + flush + delta) **17.6 µs**, a child-drag frame **11.8 µs** —
  auto-bounds are noise at frame rate.  **Renderer benchmark**
  gained `gen-25k-compound` (25k × 50k under 1k parents, leaves
  clustered per parent — scattered members would make every parent
  span the whole graph, overdraw rather than a representative
  scene): on this box (RX 580, dpr 2, scale 1) the gpu side holds
  **vsync (16.7 ms wall p50) in every scenario** — fit-all,
  zoomed-in, far-zoom, labels on — while v3 canvas runs ~2 s/frame
  fit-all and ~240 ms zoomed-in; init 296 ms vs 5.1 s.  Final docs
  true-up in this commit.  **Round 14 is complete.**

**Risks tracked per item**: flush re-entrancy (raw-column reads
only); parent `width()` readback consistency across style/bb APIs;
recycled parent slots (gen guard); leaf↔parent flips (size
stash/restore, label re-anchor); deep-nesting drag cost
(`markChildGeo` early-exit; the benchmark item guards it);
mid-tween reparent settle; parent decoration bands above edges
(recorded, z-index round); the shared pick/draw order helper; wire
backward compat (optional section).

## Design sitting (2026-08-01) — z-index dropped; rounds 15–18 scoped

Decided with the user in one sitting.  Every round below runs under
the round-10 process rules plus the round-14 amendments, now standing
policy: **docs land first** (each round's 0-item commits its plan
section + README pointer before any implementation) and every item is
**tests-first** (specs written and seen red before the implementation
brings them green, landing together as the item's isolated commit).

**The z-index call — dropped outright.**  v4 ships no `z-index`, no
`z-compound-depth`, no `z-index-compare`, and no built-in grab-raise
either.  Reasoning, recorded: element stacking is a document/UI
concept without a strong graph use case — node overlap is a layout
artifact rather than an authored arrangement, layered emphasis is
already served structurally (parents under edges under leaves under
labels; overlay/underlay props; opacity dimming), and v3 carried the
prop triple at the cost of a whole-scene comparator sort per frame.
The compound worry raised in the sitting (edges into child nodes must
stay visible) is already answered by the round-14 stream split:
parent *bodies* draw under all edges, leaves above them.
Consequences, now permanent (all were already recorded deviations):
draw order is structural + slot order within a stream; a grabbed node
does not pop above later-inserted nodes; parent decorations
(ghost/underlay/overlay/label bands) keep their post-edge positions.
`sortByZIndex`/`zDepth` close with the props.  The only logged future
extension, if real demand ever appears, is a single boolean
**elevated tier** (one extra batch per group drawn over the leaf
stream) — never arbitrary integer stacking; logged, not planned.

**Queue after the sitting**: background images (round 15) →
multiline labels + label bb (round 16) → event vocabulary + the
extension contract (round 17) → GPU force layout (round 18).

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
   free-list alloc/reclaim, growth by realloc-copy.  Rationale from
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
   resolution is their ceiling, as in v3).  **Exports re-raster**:
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
   icon color mapper-drivable.  Recorded: a multi-color source in
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
  `src/gpu/image-registry.mts`: entries dedup by (kind, crossorigin,
  url) with refcounts; freed ids recycle through a free-list and
  report to the renderer via `takeFreed()` (the layer reclaim
  channel); rgba tier assignment from the decoded longest side
  (128/512/1024, cap tier clamps); sdf-icon entries raster at the
  fixed `SDF_IMAGE_SIZE` and carry no rgba tier; decode runs behind
  an injectable async rasterizer (`setDecoder` kicks entries
  acquired headless — the mount path), failures warn once per url
  and stay failed (re-acquire never re-kicks), and a decode
  resolving after its entry was freed is dropped by object identity
  so recycled ids can never take stale rasters.  `promote(id,
  demandPx)` re-rasters *vector* entries at the smallest covering
  tier (the 15.6 meter's primitive; raster sources and covered
  demands no-op).  Tests-first: 10 specs in
  `test/gpu-image-registry.mjs` red then green — 2059 Node tests,
  typecheck + lint clean.
- [x] **15.2 Props + model** (2026-08-01) — contract first:
  `node.imageRef` (offset | count << 24 into the new image-record
  pool — a third `CurveBlob` with round-11 compaction, relocations
  rewriting the ref column) + `delta.imageBlob` +
  `ModelView.imageBlob()/images`.  `GraphStore.setNodeImages` packs
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
  specs in `test/gpu-background-image.mjs` red then green — 2076
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
  and scales UVs into partially-filled layers.  The FS walks the
  blob records in list order compositing later-over-earlier,
  samples with **textureSampleGrad** (explicit gradients hoisted to
  uniform flow, so the per-record branching is legal), emulates
  smoothing: no by texel-center snapping, masks `clip: node` by the
  node SDF — containment `inside` clips at the border's inner edge
  (border stays visible; a translucent border shows fill, not
  image — recorded beside the B1 band rule), `over` at the shape
  boundary — and confines repeat tiles to the node box (recorded).
  `clip: none` rects grow the quad in the VS.  The mirror gained
  the image blob's realloc/span twin; the browser decoder
  (`render/image-decoder.mts`: fetch + createImageBitmap, SVG via
  img + canvas at target size, decode-time downscale into the cap
  tier, crossorigin modes with `null` narrowed to same-origin —
  recorded) attaches at init and detaches on destroy.  WGSL lesson
  re-hit and re-recorded: `ref` is reserved (the console-error
  guard caught it).  Verifies: 6 Node specs
  (`test/gpu-image-arrays.mjs`, tests-first), the `images-basic` and
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
  pixel-pinned).  The cap-overflow warn landed in 15.2.  2083 Node
  tests, 124/124 Playwright, typecheck + lint clean.
- [x] **15.5 SDF icon mode** (2026-08-01) — the glyph trick,
  generalized: sdf-icon sources raster once through the decoder's
  alpha-grid path (SVG via img + canvas, rasters via bitmap +
  canvas — a multi-color source collapses to its alpha silhouette;
  recorded), the **glyph atlas's exact `computeSdf` EDT** runs at
  upload, and the field lands in a dedicated r8
  `texture_2d_array` (fixed 128², layers slot-allocated as tier
  index 3 in the shared TierAllocator, no mips — the field
  re-thresholds at any scale).  The FS icon branch samples with
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
  eventual reclaimer (recorded simplification).  **Exports
  re-raster**: `exportImage` promotes at the export view's
  zoomDpr (no viewport test) and awaits `registry.whenSettled()`
  (bounded 2 s; in-flight tracking landed in the registry with its
  own Node specs), syncing the fresh rasters before the export
  frame encodes.  Fix fallout caught by the suite: the 15.5
  crispness spec's rgba contrast switched to a *raster* square —
  the meter (correctly) sharpened its auto SVG.  Pins: zoom 6 →
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
  20 px under a 30 px floor, ink appears at zoom 2).  The renderer
  benchmark gained **`gen-25k-images`** (25k × 50k, four icon types
  via `data.itype`, styled through the ordinal url mapper on the
  gpu side and type selectors on v3; icon data-uris built at page
  runtime) — the scene is wired like its siblings; numbers were not
  recorded on this box (software adapter — a different machine
  class, per the benchmark's own warning).  The ordinal-url mapper
  form is Node-pinned.  Final docs true-up in this commit.
  **Round 15 is complete.**  2085 Node tests, 129/129 Playwright,
  typecheck + lint clean.

**Risks tracked**: upload bursts on initial load (decode is already
async; uploads coalesce per frame); WGSL non-uniform texture access
(explicit-gradient sampling or sample-both-select — chosen at
implementation, pinned by goldens); crossorigin/tainting differences
between decode paths; registry leaks under style churn (refcount
specs); multi-image FS cost (the benchmark item guards it).

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
   (cheap and exact).  Edge labels keep the dual tier: the scan
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
  `render/label-wrap.mts`: `breakLines` (v3's `text-wrap` semantics —
  `none` collapses newlines, `wrap` honors `\n` + greedy word wrap
  with `whitespace` overflow vs `anywhere` mid-word splits,
  `ellipsis` truncates one line with '…'), `layoutLabelBlock`
  (lines stacked by lineHeight × em, justified inside the block,
  block centered about x = 0), and **`estimateBlock`** — the same
  breaking logic over flat per-char advances, which is what keeps
  the 16.4 label bb meaningful *headless*: the store estimates dims
  with no renderer, and rendered instances upgrade them to exact
  laid dims (a recorded approximation).  Advances are injected, so
  one breaker serves both consumers by construction.  11 Node specs
  in `test/gpu-label-wrap.mjs`.  2096 Node tests, typecheck + lint
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
  declared value incl. 'auto', as v3.  **Label dims live in the
  store** (`labelDimsAt`/`setLabelDims`, per stream): `setLabel`
  estimates immediately via `estimateBlock` — the headless bb
  input — and the renderer's glyph build upgrades to exact laid
  dims (never marking label-dirty — no rebuild loop); dims changes
  bump the geometry epoch, since labels join bounding boxes in
  16.4.  `label-wrap.mts` moved to the gpu root (a dual-consumer
  module, the curve-geometry precedent).  One historical pin
  updated: gpu-style's unsupported-prop example was `text-wrap`,
  which now exists — it pins `background-blacken` (dropped by
  decided design) instead.  Tests-first: 10 specs in
  `test/gpu-text-wrap-props.mjs` red then green — 2106 Node tests,
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
  churn.  Autorotate needed nothing: glyphs rotate about the anchor
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
  never under).  `eles.labelBoundingBox()` is the public exact
  measure (the v4 form of v3's text-metrics surface): node labels
  at anchors, mid-labels at the drawn (curve-aware) midpoint, end
  labels via the endpoint radius.  Headless dims are estimates
  (recorded — 16.1's estimator); rendered instances re-fit exact.
  No golden churn (goldens pin explicit viewports) and zero
  regressions across the 2116-test suite; the fit semantics are
  pinned headless in `test/gpu-label-bb.mjs` (10 specs, red first —
  incl. getFitViewport reading the label-inclusive box), which
  covers what the planned browser fit spec would have.  131/131
  Playwright, typecheck + lint clean.
- [x] **16.5 Box-select labels + benchmark + true-up** (2026-08-01)
  — **`boxSelectionIncludesLabels`** (ctor option +
  getter/setter, default false — v3's box-select-labels default):
  `refsInBox` additionally requires the node's label box inside the
  band; Node-pinned (label poking out excludes the node only when
  opted in; runtime toggle).  **Shaping cost swept**
  (`benchmark/gpu/labels.mjs`, pure Node at 100k wrapped labels):
  breakLines ~3.8 µs, estimateBlock ~4.6 µs, the full
  setLabel-with-estimate write ~5.1 µs/label (write-driven, never
  per frame), and the whole-graph bb scan pays ~0.1 µs/label for
  its label terms.  **Memo hit-rate pinned** in a `webgpu` spec:
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

## Round 17 plan — event vocabulary + the extension contract (planned 2026-08-01)

Two permanent-API calls made in one sitting: the v4 event names, and
how extensions plug in.  Both are cheap to build once decided; both
gate ecosystem work.

**Signed-off design calls:**

1. **The curated vocabulary, plus the official pointer family.**
   Adopted with v3 semantics (each firing rule pinned against v3
   source in a red spec before implementation):
   - *Drag-state* (elements): `grab`, `grabon`, `drag`, `free`,
     `freeon`, `dragfree`, `dragfreeon` — the `-on` variants fire
     only on the directly grabbed element; the plain forms fire on
     every node the gesture moves (drag companions included);
     `dragfree`/`dragfreeon` only when the node actually moved.
   - *Device-normalized*: `tapstart`, `tapdrag`, `tapdragover`,
     `tapdragout`, `tapend` (element + core), `tapselect`/
     `tapunselect`, `cxtdragover`/`cxtdragout`.
   - *Viewport gestures* (core): `dragpan`, `scrollzoom`,
     `pinchzoom`.
   - *Pointer re-emits* (element + core): `pointerdown`,
     `pointermove`, `pointerup`, `pointercancel`, `pointerover`,
     `pointerout` — the official DOM vocabulary v4's interaction
     layer already consumes, re-emitted with graph positions and
     `originalEvent`.
   **Dropped, recorded**: the `vmouse*` aliases (the `tap*` names
   *are* the normalized vocabulary) and the raw mouse/touch re-emits
   (`mousedown`/`mousemove`/`mouseup`/`click`, `touchstart`/...) —
   `pointer*` is their one modern spelling; the existing
   `mouseover`/`mouseout` emissions stay.  `event.preventDefault()`
   stays unported (gesture defaults are gated by options/flags, not
   handlers; `originalEvent` keeps the DOM method) — recorded.  All
   new element events bubble through the round-14.5 phase machinery.

2. **Extensions are direct objects — no registry.**  No
   `cytoscape.use`, no string registration, no global state: an
   extension is an import the app passes in (tree-shakeable, typed).
   Pass 1 designs the **layout contract** only; core/collection/
   renderer extension points stay out (recorded: mappers +
   predicates cover the common cases; revisit on demand).
   - **Shape**: a layout impl implements
     `{ run(ctx): void | Promise<void>, stop?(): void }`.
     `cy.layout({ impl: Fcose, ...options })` (and
     `eles.layout({ impl, ... })`) construct and run it through the
     existing lifecycle — `layoutstart`/`layoutready`/`layoutstop`
     on the core, `promiseOn`, `stop()`, the animate/fit plumbing;
     `{ name }` keeps addressing builtins.
   - **LayoutContext (`ctx`) is columnar-first**: slot-indexed reads
     (a positions view, node iteration pre-filtered to unlocked
     leaves per the round-14 rule, CSR adjacency, per-slot degree,
     the scoped element list for subset layouts, bb/viewport
     helpers, resolved options) and one bulk write —
     `setPositions(slots, xy)` on the round-5 slot path (one dirty
     span, listener-gated events) — plus the `layoutPositions`
     finisher (spacingFactor/transform/animate/fit, v3 plumbing).
     Handles stay reachable (`ctx.eles`) at handle cost; the
     contract makes the columnar path the obvious one.
   - Layout instances stay non-emitters (v4 layout events fire on
     the core — the round-10 rule, recorded).

**Pass split** (tests-first per item; docs in-commit):

- [x] **17.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-17 implementation.
- [x] **17.1 Pointer re-emits + tap family** (2026-08-01) — the
  official vocabulary lands: `pointerdown` (all buttons, the cxt
  branch included), `pointermove` (every move),
  `pointerup`/`pointercancel`, and `pointerover`/`pointerout`
  riding the hover transitions beside mouseover/mouseout; plus the
  device-normalized `tapstart` (primary press), `tapdrag` (moves
  while a press is active — the raw pointermove covers unpressed
  motion) and `tapend` (release of a press, ahead of the
  tap/selection flow — v3's up → tapend → tap ordering).  Targets
  follow the press (the grabbed/cxt element) else the hovered
  element, background to the core; touch arrives through the same
  pointer handlers by construction.  Pinned by a `webgpu`
  mouse-driver spec (hover-over/out, press-drag-release on the node
  and on the background).  2117 Node tests, 133/133 Playwright,
  typecheck + lint clean.
- [x] **17.2 Drag-state family** (2026-08-01) — `grab`/`grabon`,
  `drag`, `free`/`freeon`, `dragfree`/`dragfreeon` with v3's firing
  rules: the `-on` variants fire only on the *directly* grabbed
  element; the plain forms fire on it **and every selected
  companion** in the drag set; `drag` fires per movement on all of
  them; the dragfree pair fires only when the gesture actually
  moved; a cancelled gesture frees without dragfree.  Pinned red
  first in a `webgpu` mouse-driver spec: exact per-name counts on a
  two-selected-node drag (companion never gets `-on`), grab → drag
  → free ordering, and a moveless press grabbing/freeing without
  drag events.  2117 Node tests, 134/134 Playwright, typecheck +
  lint clean.
- [x] **17.3 Selection + hover-during-drag** (2026-08-01) —
  `tapselect`/`tapunselect` fire on the tapped element beside its
  gesture-driven select/toggle-off (background clears and box
  selection keep their own events, as v3); `tapdragover`/
  `tapdragout` and `cxtdragover`/`cxtdragout` ride a throttled
  synchronous node pick while a press is active — **nodes only**
  (the exact CPU pick; edges would need the async GPU tile —
  recorded), state cleared silently when the gesture ends.  Spec
  lesson kept in-file: a *panning* background drag moves the
  content with the cursor, so nothing is ever crossed — the pin
  drags across the node under the box gesture (panning disabled)
  and under a cxt drag.  2117 Node tests, 135/135 Playwright,
  typecheck + lint clean.
- [x] **17.4 Viewport gesture events** (2026-08-01) — `dragpan`
  (each applied background pan step), `scrollzoom` (each wheel zoom
  — trackpad pinches arrive as ctrl+wheel and take this path, the
  round-10 rule) and `pinchzoom` (each two-finger zoom step), all
  core-level with the gesture's model position.  Pinned in a
  `webgpu` spec (wheel, background drag-pan, and a synthetic
  two-finger pinch — each firing its own name and not the others').
  2117 Node tests, 136/136 Playwright, typecheck + lint clean.
- [x] **17.5 The layout contract** (2026-08-01) —
  `layout/contract.mts`: `cy.layout({ impl, ...opts })` (and
  `eles.layout`) runs a user class (constructed argless) or object
  implementing `{ run(ctx), stop?() }` — **no registry, no
  cytoscape.use, no global state**.  `run` may return a promise
  (the GPU-layout shape); the wrapper exposes `promise()` and
  drives the core lifecycle exactly once per run whether the impl
  uses the discrete finisher (`ctx.layoutPositions(fn)` — the full
  v3 plumbing, its layoutstart folded into the wrapper's via an
  internal flag) or the direct bulk path (`ctx.setPositions` on
  the round-5 slot path).  The **LayoutContext is columnar-first**:
  `nodeSlots()` (scope order, pre-filtered to unlocked leaves —
  the 14.11 rule), live `positions()`/`endpoints()` views,
  O(1) `degreeOf` off CSR, `edgeSlots()`, scope bb + viewport
  dims, `ctx.options` carrying custom knobs, with handles reachable
  at `ctx.eles`/`ctx.nodes`.  Layout instances stay non-emitters
  (round-10 rule; events fire on the core with the wrapper as
  `event.layout`).  Tests-first: 10 specs in
  `test/gpu-layout-contract.mjs` red then green — object + class
  impls, single-lifecycle finisher, async run, scoping, the
  leaf/unlocked filter, columnar reads, stop(), malformed rejects,
  and the random builtin re-expressed through the public contract
  (the conformance shape external authors can crib).  Two
  error-message pins updated for the new layout dispatch text.
  2127 Node tests, typecheck + lint clean.
- [x] **17.6 Example + true-up** (2026-08-01) — `debug/webgpu`
  gained the worked example: `SpiralLayout`, a plain class run via
  `cy.layout({ impl: SpiralLayout })` with `?layout=spiral`
  (smoke-verified live in scripted Chromium: spiral positions, no
  page errors).  README gained the round-17 section (the curated
  vocabulary with its recorded drops + the direct-object contract).
  **Round 17 is complete.**  2127 Node tests, 136/136 Playwright,
  typecheck + lint clean.

**Risks tracked**: name-semantics divergence from v3 (red specs
against v3-source readings per event, before implementation); emit
volume on drag hot paths (all listener-gated; the 17.2 specs assert
the no-listener fast path stays allocation-free); contract surface
creep (pass 1 exposes only what random-via-contract and an
fcose-shaped consumer demand).

## Round 18 plan — GPU force layout (planned 2026-08-01)

The last queue pillar: the round-9 "GPU layouts: logged for later"
design, built.  Signed off 2026-08-01.

**Signed-off design calls:**

1. **A new GPU-native layout, `force`** — not a cose port (v3's
   cose stays in v3: its option surface and per-iteration structure
   are CPU-shaped, and ports arrive later via the round-17
   contract).  The model: spring attraction along edges toward
   `edgeLength`, short-range repulsion via a **uniform-grid cutoff**
   (grid rebuilt per iteration by counting sort — the
   stream-compaction discipline — repulsion gathered over the 3×3
   cell neighborhood), a weak centering gravity that keeps
   disconnected components in frame, velocity integration with
   alpha cooling, and seeded deterministic initial scatter (id-hash,
   the haystack precedent).  Force accumulation is **gather-only —
   no atomics** — so a run is deterministic on a given executor
   (fixed reduction order).
2. **Ownership: GPU-authoritative with readback on settle** — the
   round-9 logged design.  During a run the position column is
   GPU-owned under the existing lease machinery (mirror skips
   uploads; CPU reads stale per the motion-staleness rule); the sim
   integrates in its own pre-cull pass so cull/edges/labels read
   live positions and the graph **renders live every frame** — the
   watchable-layout-at-100k showpiece.  On convergence (max
   displacement < ε for K consecutive iterations) or `stop()`, one
   readback settles the CPU columns — the sole readback exception
   in the architecture, per the round-9 call — then derived
   geometry flushes and `layoutstop` fires.
3. **The CPU reference is the spec.**  A complete CPU implementation
   (same options, same grid/cutoff math) runs headless instances
   and is what the Node specs pin (seeded runs to fixed coordinates
   on small graphs, energy decay under cooling, convergence,
   locked-node pinning).  CPU and GPU trajectories are **not
   bit-agreed** (recorded — parallel FP reduction order differs):
   GPU correctness pins invariants instead — no NaN/exploded
   positions, displacement decay, seeded summary statistics (edge
   length distribution, bb extents) within tolerance of the CPU
   run.
4. **Demotions and scoping** (the 14.11 pattern): compound graphs
   run the CPU executor (a GPU lease would leave the auto-bounds
   derivation reading stale positions; leaves simulate, parents
   derive per flush).  Locked nodes pin (skip integration).
   Subset layouts (`eles.layout`) simulate the subset only;
   non-members are inert (recorded).  Flat graphs at scale — the
   perf case — take the GPU path.
5. **Options surface** (minimal, consumed identically by both
   executors): `edgeLength` (number, or a plain function evaluated
   once into a per-edge column at start — the algorithms-round
   rule), `repulsion`, `gravity`, `decay`, `iterations` (cap),
   `threshold` (ε), `seed`, `randomize` (fresh seeded scatter vs
   current positions), `animate` (`true` live | `false`
   settle-then-draw), `fit`/`padding`.

**Pass split** (tests-first per item; docs in-commit):

- [x] **18.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-18 implementation.
- [x] **18.1 CPU reference** (2026-08-01) —
  `layout/force-sim.mts`, pure and slot-indexed: uniform-grid
  cutoff repulsion (counting-sort rebuild per iteration; stable
  ascending order inside cells — the deterministic gather order
  both executors share), springs off CSR-style incident lists,
  centering gravity, and **pure damped gradient integration**
  (`F · alpha` per step, no velocity state — no ringing, one less
  GPU buffer, and displacement tracks force so the threshold
  settle is robust; velocity integration was tried and dropped for
  exactly the ringing-trips-the-settle failure).  Forces gather
  into a scratch and apply in a second pass (the kernel's
  two-dispatch structure).  **Model calls made empirically**, both
  recorded: the repulsion cutoff is the *mean ideal edge length* —
  repulsion vanishes exactly where a spring rests, so a connected
  pair's equilibrium is L itself (cutoff 2L left it at 1.7L); and
  a cutoff model does **not** promise global untangling — a curled
  chain is a legitimate local minimum (sfdp-style multilevel is
  future work).  Coincident points separate along a deterministic
  index-hash direction (no NaNs on degenerate input).  Tests-first:
  8 specs in `test/gpu-force-sim.mjs` — seeded determinism,
  identical-run reproducibility, spring rest length, repulsion
  separation, gravity containment, cooling/convergence, pinning,
  and the path-relaxation invariants.  2135 Node tests, typecheck +
  lint clean.
- [x] **18.2 Layout plumbing** (2026-08-01) — `layout/force.mts`:
  `cy.layout({ name: 'force' })` wraps `ForceLayoutImpl` in the
  **round-17 CustomLayout plumbing — the contract's first
  production consumer** (an external layout would ship identical
  code).  Options: `edgeLength` (number or a plain fn of the edge
  handle, resolved once — the algorithms rule), the sim params
  (repulsion/stiffness/gravity/decay/iterations/threshold),
  `seed`/`randomize` (fresh deterministic scatter vs relaxing
  current positions; pinned nodes keep real coordinates either
  way), `animate` (live streaming per frame through the bulk slot
  path — which, as recorded, emits no per-node position events —
  vs settle-then-draw), `stepsPerFrame`, `fit`/`padding`.  Scoping:
  leaves only (parents derive); **locked nodes pin** — they join
  every force pair but never move; subset scopes simulate the
  subset only (recorded).  `stop()` settles early through the
  wrapper.  Tests-first: 7 specs in `test/gpu-force-layout.mjs` red
  then green — lifecycle + ring relaxation + fit, seeded
  determinism end-to-end, fn edge lengths, locked pinning, compound
  leaves-only, subset scoping, live streaming + stop.  2142 Node
  tests, typecheck + lint clean.
- [x] **18.3 GPU kernels** (2026-08-01) — `render/gpu-force.mts`:
  six dispatches per iteration (clear grid → bin count → serial
  exclusive scan → scatter → force gather → apply), sim-indexed
  with `apply` publishing movable nodes into the slot-indexed
  mirror position buffer — encoded ahead of the cull pass, so
  edges/labels follow live; node.position rides the tween-lease
  ownership (mirror skips its uploads; the frame loop keeps its
  clock while a run is live).  **Binding-budget lesson re-hit on
  compute**: three shared bind groups totalled 16 storage buffers
  (the console guard caught it) — each kernel now carries its own
  group with exactly its buffers, the hot gather packing inputs
  (CSR as one [starts][entries] buffer; edges at stride 3 with
  bitcast lengths; the pin flag on bit 31 of the slot map; the
  alpha window + tick + displacement max sharing one atomic meta
  buffer) to land the force kernel at exactly 8.  WGSL lesson #3:
  `meta` is reserved too.  Alpha annealing pre-computes a
  64-iteration window per frame indexed by a device tick (any k
  iterations per submit, no per-iteration uniform writes);
  convergence rides an atomicMax over monotonic f32 bits with a
  4-byte latest-wins staging poll; `readPositions()` is the one
  settle readback (round 9), after which the layout writes the CPU
  columns through the normal dirty-span path.  **Recorded
  narrowing**: the scatter's atomic in-cell order means GPU
  trajectories aren't bit-stable run-to-run — seeded
  reproducibility is the CPU executor's guarantee.  Pinned on a
  real adapter: a provably-long run holds the lease (CPU
  `position()` stale mid-run while pixels advance), `stop()`
  settles real simulated coordinates, and the ring spreads.  2142
  Node tests, 138/138 Playwright, typecheck + lint clean.
- [x] **18.4 Convergence + readback** (2026-08-01) — the batched
  displacement reduction, latest-wins staging poll, settle readback
  and lease-release-before-CPU-write ordering all landed with 18.3;
  this item adds the **invariant parity suite**: on a seeded
  ring-with-chords graph, the CPU executor (animate: false) and the
  GPU executor (animate: true) run the same options and must agree
  on invariants — zero NaN, every node in frame, mean link length
  within [0.6×, 1.7×] of each other, bb width within [0.4×, 2.5×] —
  while trajectories stay deliberately not bit-agreed (recorded).
  The settled bb also pins flushDerived + layoutstop ordering (the
  box reflects the readback coordinates).  2142 Node tests, 138/138
  Playwright, typecheck + lint clean.
- [x] **18.5 Benchmarks + harness + true-up** (2026-08-01) —
  `debug/webgpu/?layout=force` (+ `&seed=N`) runs the live layout
  in the harness (smoke-verified twice in scripted Chromium: zero
  page errors, identical settled extents run-to-run; an earlier
  error burst traced to racing a mid-write bundle on the static
  server, not the code).  The renderer benchmark gained
  **`-- --layout`**: instead of the pan scenarios, each scene runs
  a live force to convergence on the gpu side (wall time + fps
  from renderer stats) with v3's cose as the classic baseline —
  layout quality differs by design; the numbers compare the
  interactive experience.  Numbers recorded 2026-08-01 on real
  hardware — see "Landed (hardware validation pass)" at the end of
  this file, which also corrects this item's original
  "software adapter on this box" assumption.  README
  gained the round-18 section and the round-9 "GPU layouts:
  logged" design bullet is trued up (since built).  **Round 18 is
  complete.**  2142 Node tests, 138/138 Playwright, typecheck +
  lint clean.

**Risks tracked**: pathological densities collapsing the grid (all
nodes in one cell → O(n²) gather; cell-capacity clamp + jittered
seeds, recorded); convergence-check cost (batched reduction);
readback vs in-flight frames (reuse the pick-ring discipline);
executor parameter drift (all constants resolved once, shared by
both executors); interaction mid-run (grab during a layout follows
the animation rule — grabbing is forbidden while an element's
position is leased).

## Landed (hardware validation pass — AMD RX 580, 2026-08-01)

The first full benchmark run of the prototype on real hardware:
Radeon RX 580 (RADV, `amd gcn-4`) on an i9-9900K under Linux,
headless Chromium with the repo's platform-gated ANGLE-on-Vulkan
flags.  Corrections first:

- **The 18.5 "software adapter on this box" note was wrong** —
  headless Chromium offers the hardware adapter with the same flags
  `playwright.config.js` uses.  The trap that produced the earlier
  conclusion: `requestAdapter()` returns null on `about:blank`, so a
  bare-page probe reads as "no GPU"; the benchmark's own probe runs
  on its served page and gets the real adapter.
- **The `--layout` mode was intractable as landed** (it had only
  ever been smoke-tested): cose's per-iteration cost is superlinear
  — ~4.5 s/iteration at 25k × 50k, ~52 min for a *single* iteration
  at 100k × 300k — so the `numIter: 300` baseline hung the suite
  for hours.  Fixed in `b7ea7068` with nested test-style timeouts
  (in-page 30 s polite stop reporting a measured floor + 60 s
  runner-side hard bail that force-closes the wedged page and
  reports "> 60 s"; `--layout-uncapped` removes both).  Two
  starvation findings recorded in that commit: `setTimeout` runs
  minutes late under cose's synchronous iteration blocks, and even
  a rAF watchdog only runs at paint time (first paint 70 s after
  `run()` at 25k with `refresh: 1`), so the hard bail is the only
  reliable bound.

Numbers (dpr 2, 1280×800, adaptive render scale pinned to 1; wall
times are vsync-bound at 60 Hz, so 16.7 ms is the floor):

- **Pan steady state**: v4 holds the vsync floor on every generated
  scene and view — 25k and 100k flat, curved (bezier pairs),
  compound (1k parents), images, labels on and off — while v3
  canvas runs ~230–4200 ms/frame on the same content (25k fit-all
  633 ms → 16.7 ms; 100k fit-all 3693 ms → 16.7 ms).  ndex-x-large
  (465k edges) is the one scene above the floor: 33.4 ms wall
  (2 vsync frames).
- **Device time** (timestamp-query, the unbounded metric): the
  worst generated-scene pass is 19.6 ms (100k zoomed-in, labels);
  ndex fit-all ~37 ms is the only GPU-bound case — with the
  adaptive render scale deliberately pinned off, which production
  defaults would not do.  Labels add +0.2–1 ms per pass; the
  compound scene's parent stream costs ~nothing (2.0 ms fit-all).
- **Init**: v4 246 ms–1.7 s vs v3 2.6–19.2 s per scene (10–20×).
- **Picks under continuous pan**: p50 17–19 ms; 4–5 of 25 requests
  return null.  ~~Flagged for a look~~ — resolved by the pick-ring
  look below: the nulls were **background answers**, not staging-ring
  drops (the scenario holds at most one pick in flight, so the 3-slot
  ring cannot exhaust — the attribution here was wrong), and the
  drop-on-exhaustion policy itself is gone (a full ring now defers
  the request a frame instead).
- **Live layout (`--layout`)**: v4 `force` converges in 697 ms
  (25k), 1472 ms (100k) and 952 ms (ndex) on the GPU executor;
  the compound scene settles in 15.5 s on the CPU executor (the
  14.11 lease rule).  v3 cose reports "> 60 s — bailed" on every
  scene; measured floors from the pre-fix runs: 67 s at 25k,
  3169 s at 100k.

## Landed (pick-ring look, 2026-08-01)

The hardware pass flagged its pick numbers — 4–5 of 25
hover-while-panning requests returning null, attributed to
staging-ring exhaustion — for a look.  The look found the attribution
**wrong**, and a latent policy wart behind the phrasing it leaned on:

- **The nulls were background answers, not drops.**  The benchmark's
  pick scenario holds at most *one* pick in flight (a new `cy.pick()`
  is only issued once the previous one resolved, with a 120 ms gap),
  and one logical request consumes at most one ring slot — so the
  3-slot staging ring **cannot exhaust under that driver**.  The
  nulls are genuine background answers: at fit-all the five probe
  points (0.3–0.7 along the diagonal) mostly sample empty space
  between hairline edges, and far-zoom decimation additionally makes
  sub-half-alpha edges unpickable (the recorded deviation).  The
  scenario's own comment admitted the ambiguity ("background answer
  or a dropped request — the API can't tell them apart"); the
  hardware-pass note picked the wrong branch.
- **Drop-on-exhaustion is gone; a full ring defers instead.**  The
  old policy resolved requests null when no staging buffer was free —
  and the frame had *already encoded and submitted* the full pick
  cull + draw pass before `encodeCopy` threw the copy away.  Now the
  frame checks `hasFreeSlot()` before encoding anything: a saturated
  ring skips the pick pass entirely and leaves the request pending
  (still coalescing latest-wins), and the frame loop's existing
  `hasPending()` reschedule retries it — a slot frees as soon as the
  oldest readback maps, so the extra latency is bounded by in-flight
  GPU work (~1–2 frames).  A pick now resolves null only for
  background, destroy, or device loss — spurious nulls are
  structurally impossible, which also makes the benchmark's `nulls`
  count unambiguous (background only).
- **Saturation is observable**: `renderer().stats().pickDeferrals`
  counts frames that found the ring full and deferred; the pick
  scenario reports it per run (`N background, M ring-deferred`).
- **Confirmed on the hardware-pass box** (RX 580, same config): the
  pick scenario on the four 25k scenes (flat, curved, compound,
  images) reports 4/4/5/5 background answers and **0 ring-deferred**
  on every scene at p50 16.9–18.1 ms — the same numbers the hardware
  pass recorded, now with the null counts attributed correctly.
- Tests: `test/modules/gpu-picking.mjs` unit-tests the ring against a
  fake device (latest-wins coalescing; exhaustion defers — the
  request survives the full ring unresolved, acquires the next freed
  slot, and resolves with a real answer; destroy resolves null), seen
  red under the drop policy first.  A `webgpu` Playwright spec
  saturates picks across frames over an edge (pan-jiggled so every
  request misses the cache) and asserts none resolve null.

## Round 19 plan — slot-moving compaction (planned 2026-08-01; landed the same day — see the Landed section at the end of this file)

The last open architectural item ("Logged — compaction" above): move
live element slots so `highWater`, column capacity and pass-iteration
widths shrink after big removals (the shrink profile) and sustained
churn (the free-list keeps tables from growing, but peak-sized scans
and dispatches persist).  The slot-stable tier (id blob, CSR,
dictionaries) has self-compacted since round 11; this round moves the
slots themselves.

**The three policy calls, decided with the user (2026-08-01):**

1. **Ref survival: forwarding + lazy repair.**  A per-group
   forwarding table maps a moved element's old (slot, gen) to its new
   slot; refs repair lazily on access, and a store-wide compaction
   epoch invalidates cached packed-int membership sets.  User-held
   collections keep working — the interned-singleton invariant and
   the hold-a-query-result app pattern survive, with the cost paid
   only on first post-compaction access.  (Rejected:
   handles-survive-collections-stale, everything-stale — both make
   compaction an app-visible event, which an *auto* trigger cannot
   afford.)
2. **Trigger: auto threshold + explicit `cy.compact()`.**  Auto on a
   dead-slot-ratio threshold (the round-11 waste-over-half policy
   with a floor, metered per group), gated to safe boundaries — never
   mid-batch, mid-emit, mid-frame-encode, or while a GPU force run or
   GPU-offloaded tween is live (live tweens settle first via the
   round-14.11 `settleGpuAll` precedent, or the check defers to the
   next safe boundary).  `cy.compact()` is also public for
   deterministic timing (throws mid-batch; defers with a warn while a
   force run is live).  The shrink profile is exactly where apps
   won't know to call `compact()` — auto is the user-serving default.
3. **Draw order: stable — a visual no-op.**  Compaction preserves
   the current relative slot order.

**The load-bearing consequence: the remap is monotone.**  Moving live
slots down in ascending order (each live slot drops to the lowest
free position below it) preserves relative order by construction,
which is what makes call 3 free — and it is *also* what keeps derived
curve geometry identical: bundle rank (`bundleOffset` over the
sorted bundle), loop stagger index, and the σ orientation sign all
derive from relative slot order (`curve-index.mts`), so a monotone
remap leaves every derived curve param byte-identical and no pair
re-derivation is needed.  CSR per-node incident order (insertion
order) and the cpu-pick z-rule (topmost = highest slot) are likewise
unchanged.  A non-monotone remap would silently change z-order and
curve geometry; the implementation asserts monotonicity in dev.

**Remap inventory** (surveyed 2026-08-01; classification per
structure): the store tables permute per column (`arrays`, `gen`;
`free` clears; `highWater` shrinks to the live count; capacity
shrinks realloc the columns); `edge.endpoints` is the one column
holding cross-group slots (a node remap rewrites it wholesale); the
id index fuses the permutation into its `compactBlob` walk + full
probe rehash; CSR rebuilds via the round-11 `Adjacency.rebuild`;
hierarchy permutes `parent`/`parentGen`/`depth` and rebuilds
`children`, nulling the parent draw permutation (renderer re-uploads
on identity change); the curve index permutes its per-edge records
and rebuilds `pairs`/`loops` keys (params untouched — monotone); the
three blobs permute their slot-indexed offset tables (pools are
offset-space); the data sidecar permutes `values`/`present`/
`indices` **in place** (bound mapper evaluators close over those
buffers by reference — the dict-remap precedent); label sidecar
entries/dims/dirty rekey per stream; the misc slot-keyed maps
(`opacityBase`, `parentFallback`, `compoundStyle`, `resolvedPad`)
rekey; `geoEpoch` bumps (edge-bb memo); monotone maxima recompute
exactly (a compaction is the natural moment); mapper spans re-emit
whole-column.  Renderer: both groups' `resized` flags are set — the
existing paths do the rest (mirror full realloc + re-upload — a
capacity change already forces it — pick-cache invalidation, cull
`meta` rewrite); the mapper runtime reconfigures (region layout is
capacity-aligned); glyph streams rebuild owner words via
`markAllLabelsDirty` + `process` (the re-raster path); GPU tween
channels re-register their slot buffers after the settle;
`ChannelWrite.slots`/animation-queue packRef keys rebuild.

**Items (tests-first, one isolated commit each):**

- **19.1 — store-core compaction.**  `ColumnTable.compact(perm)` +
  `GraphStore.compact(group?)`: the monotone permutation build, column
  moves with capacity shrink, order-list fusion (`compactOrder`
  already drops tombstones), id-index fusion, `edge.endpoints`
  rewrite on node moves, CSR rebuild, dirty/`resized` signaling, and
  the vacated-tail zeroing (tombstoned flags).  Node specs: state
  identity pre/post (ids, data, positions, flags, adjacency,
  ordering), `highWater === count`, shrink-profile capacity actually
  falls, idempotence (compacting a compact store is a no-op).
- **19.2 — dependent store indexes.**  Hierarchy, curve index +
  blobs, data sidecar in-place permute, label sidecar, misc maps,
  epochs/maxima/spans.  Node specs: compound geometry, curve
  accessors (`controlPoints`/`midpoint`/`boundingBox`) and style
  readback byte-identical pre/post; blob record integrity; mapped
  channels re-evaluate correctly after the permute.
- **19.3 — ref forwarding + lazy repair.**  The forwarding table
  (packed (group, oldSlot, oldGen) → newSlot), gen handling for
  vacated slots so stale refs *fail* plain validation and route to
  repair, `isCurrent`/`_eleFromRef` repair paths that rewrite the
  `Ref` in place (repairing every holder of that object), handle-pool
  permutation with `_refs[0]` rewrite (scratch survives), the
  membership-set epoch, packRef-keyed animation queues, event
  listener re-keying (`'ref:'` qualifiers), forwarding-chain
  composition across consecutive compactions.  Node specs: held
  collections and handles keep answering across a compaction
  (id/data/position/traversals), removed refs stay dead, membership
  caches invalidate, `off()` by handle still matches.
- **19.4 — renderer integration.**  The `resized` handshake, mapper
  reconfigure, glyph rebuild, parent-permutation re-upload, pick
  invalidation, GPU-tween settle + re-register, force-run gating.
  Playwright: pixel self-diff pre/post compaction on a styled scene
  (labels, curves, compounds, images — a visual no-op by assertion),
  pick correctness post-compaction, a mid-animation compaction
  settles and completes correctly.
- **19.5 — triggers, API, meters, benchmarks, docs.**  The auto
  threshold (dead-ratio > 1/2 with floor, per group) at safe
  boundaries, `cy.compact()` (+ the mid-batch throw and live-run
  deferral), `stats()`/store meters for observability, a
  `benchmark/gpu/` shrink/churn sweep (peak-then-small scan widths,
  dispatch counts, memory before/after), and the README section
  (design decision + deviations note) with the "Logged — compaction"
  closure.

**Recorded limits (pass 1):** compaction never runs concurrently with
a live GPU force run (defer, not settle — the sim owns positions);
`cy.compact()` inside a batch throws; a compaction mid-animation
settles GPU-offloaded tweens to the CPU first (CPU tweens remap and
continue); forwarding tables persist until the next compaction and
compose, so repair is total for any ref the app ever re-touches.

## Landed (round 19 — slot-moving compaction, 2026-08-01)

All five items of the round-19 plan above landed the same day, each
tests-first in its own commit; the three design calls held as decided
and one plan deviation is recorded below.

- **19.1 — store core.**  `ColumnTable.compact(remap, newCount)` +
  `GraphStore.compact()`: the monotone remap builds from FLAG_ALIVE
  (live slots move down in ascending order — relative order preserved
  by construction), columns and the gen array rebuild into
  right-sized (×2-step) buffers, `highWater` and capacity drop to the
  live count, the free-list clears.  Generation rule: identity slots
  keep their gens (refs to the stable prefix stay valid with zero
  repair); every changed position takes `oldGenAt(pos) + 1`, strictly
  greater than any gen ever handed out there, so all stale refs fail
  plain validation and route to forwarding.  `edge.endpoints` (the
  one cross-group slot column) rewrites on node moves; the id index
  fuses the permutation into its meta walk + a full probe rehash; CSR
  rebuilds via the round-11 path; the order list fuses against the
  pre-move gen snapshot; `resized` marks hand the renderer its
  existing realloc + full re-upload.
- **19.2 — dependent indexes.**  Hierarchy (links slot-indexed *and*
  slot-valued; parentGen re-stamps against post-move gens; child link
  order kept; draw permutation regenerates), curve index (styled
  records permute; node-keyed pair/loop maps rebuild from the
  rewritten endpoints; derived params **byte-identical** with no
  re-derivation — monotone keeps bundle rank/stagger/σ), the three
  blob offset tables, the data sidecar **in place** (bound mapper
  evaluators hold the buffers by reference), label
  entries/dims/dirty, opacityBase/parentFallback, whole-column mapper
  span re-emits, and `markAllLabelsDirty` as the glyph-rebuild feed.
  *Plan deviation, recorded*: the conservative monotone maxima are
  **not** recomputed at compaction — they stay monotone (sound; slack
  can only be loose), and exact recomputation would need per-kind
  record decoding for little benefit.
- **19.3 — ref forwarding + lazy repair.**  Per-group forwarding
  chains (packed (slot, gen) → (newSlot, newGen)) that persist and
  compose; `isCurrent()` repairs a forwarded ref **in place** before
  answering (one gen compare on the fast path; removed elements stay
  dead).  `GpuCollection._refs` became an epoch-guarded accessor —
  one chokepoint syncs all ~115 consumers and drops the packed
  membership cache (materializer sweep unchanged).  `cy._compact()`
  permutes the interned handle pool (handle identity + scratch
  survive), repairs and re-keys element-bound listener qualifiers
  (off() through fresh handles matches), and re-keys animation queues
  with slot lists re-pointed.
- **19.4 — renderer.**  Two real gaps closed: glyph streams **clear
  wholesale** on the compaction epoch (owner slots are baked into
  instances; incremental rebuild could alias a stale run onto a
  different element's new slot), and mid-flight GPU tweens **demote**
  to the CPU (write the reached value, unregister, finish on repaired
  slots — `demoteGpuAll`, unlike the reparent path's early-finishing
  `settleGpuAll`).  A live GPU force run defers compaction
  (`Renderer.forceActive`).  Everything else rides existing
  machinery: resized → mirror capacity-aware realloc + pick-cache
  invalidation; mapper regions rebuild; parent permutation
  re-uploads.  Browser specs pin the visual no-op **byte-identically**
  (labels + bezier bundle + compound + selection), post-compaction
  picking, and a mid-flight animation completing at target.
- **19.5 — triggers + API + sweep.**  Auto trigger (dead > live count
  past a 1024-slot floor) at the safe boundaries (completed remove;
  outermost endBatch), deferring silently while batching or under a
  force run; public `cy.compact()` (throws mid-batch, warns + defers
  under force).  `benchmark/gpu/compaction.mjs` (200k peak → 10%,
  i9-9900K), extended into a four-section sweep (wins / costs /
  forwarding hot path / honesty controls): compact() ~114 ms
  one-shot, and the auto trigger adds it to a removal whose own
  cascade + emits cost ~1.8 s (~6% overhead; store-level removal
  without the trigger is ~0.7 s); held-collection first-touch repair
  of 20k moved refs ~0.5 ms; CPU pick 2.15 → 0.39 ms miss (~5.5×);
  cull dispatch width 200k → 20k lanes per group per frame (edges
  400k → 0); column memory 37 → 4.6 MiB (nodes), 76 → 0 MiB (edges).
  Forwarding is free on the hot path (isCurrent on a current ref
  1.01× with ~180k forward entries present; a stale chase + rewrite
  ~40 ns once per ref), and the controls confirm order-list scans /
  whole-graph bounds are ≈parity (1.1–1.2×) — compaction changes
  exactly what the design said it would.
- **19.5b — the device side, measured.**  The renderer bench gained a
  gpu-only **compaction scenario** (cut to ~10% live through the
  store — eles.remove() would auto-compact the peak state it exists
  to measure — pan at peak slot widths, `cy.compact()`, pan again)
  plus a `--gpu-only` runner flag for gpu-vs-gpu scenarios.  On the
  RX 580: wall time holds the vsync floor on both sides (a 10%-live
  scene is already fast), while the unbounded GPU pass isolates the
  dead-lane overhead — 10k live nodes panned over 100k + 300k peak
  lanes cost 2.2 ms/frame of device time, 0.5 ms once compacted
  (4.4×; ndex 1.4 → 0.9 ms); in-browser compact() is a ~57–62 ms
  one-shot at those scales.

Verification: 28 store-level + 9 ref-level + 5 trigger Node specs
(all seen red first), the full Node suite (2175), and the `webgpu` +
`webgpu-visual` Playwright projects (143 specs — goldens and live v3
parity untouched).  With this round the "Follow-up hooks" list in
`src/gpu/README.md` holds no open architecture items.

## Round 20 plan — interaction options + touch parity (planned 2026-08-01)

With the architecture queue closed (round 19), round 20 takes the
largest remaining "needs a call" cluster: gap item 8 — the
interaction tuning options and the touch gestures v4 still lacks.
Everything here is app-facing parity work; the option names and prop
semantics are permanent API, so the calls are made deliberately up
front (the round-17 discipline).

**Signed-off design calls:**

1. **The option quartet is core-level, with getter/setters.**  v3
   buries `wheelSensitivity`, `desktopTapThreshold` and
   `touchTapThreshold` in renderer options and hardcodes
   `tapholdDuration = 500`; v4 has no renderer-option surface for
   interaction (the `renderer` block is GPU tuning), so all four are
   **constructor options with `multiClickDebounceTime`-style
   getter/setters** — readable and settable at runtime, validated
   (throw on non-finite/negative; `wheelSensitivity` must be > 0),
   live-read by the pointer layer (no re-init).  Defaults are v3's:
   `wheelSensitivity: 1` (a multiplier on the wheel-zoom exponent —
   v4's base rate is unchanged), `desktopTapThreshold: 4`,
   `touchTapThreshold: 8` (css px of movement before a press stops
   being a tap; v4 previously used 4 for all pointer types),
   `tapholdDuration: 500` ms (v4 makes v3's constant configurable —
   the one deliberate surface addition, logged in the gap list).
   v3's console warning on a custom `wheelSensitivity` is **kept
   verbatim** (the hardware-variance advice is as true under WebGPU;
   emitted once per instance, from the setter or ctor).
2. **`events` is a style prop compiled to a flag bit.**  v3's
   `events: 'yes' | 'no'` ports to both element groups (default
   `'yes'`), constants or `case` mappers (CPU-evaluated — a flag
   write, like every non-paint channel).  The engine maintains a new
   store-managed `FLAG_NO_EVENTS` bit; **every pointer path excludes
   flagged elements by reading the one bit**: the CPU node pick
   (grab/tap targeting, hover, tapdragover), the GPU edge pick tile
   (the cull kernels gain a `pickMode` Frame field and drop flagged
   edges in pick mode only — scene draws are untouched: `events: no`
   elements still render), and the **box-selection gesture** (v3's
   `getAllInBox` runs over the `interactive` set, so `events: no`
   elements are not box-selectable; the gesture filters, while
   `cy.elementsInBox()` stays a pure geometric query — a recorded
   scope note).  `interactive()` becomes
   `visible() && events !== 'no'`.  An `events` flag change
   invalidates the pick-tile cache (it changes pick answers, not
   pixels).
3. **`text-events` is node-only in v4.**  v3's default is `'no'`
   (labels are pointer-transparent), which v4 already matches; the
   port makes `'yes'` mean *the node's label box is part of the node
   for picking* — the CPU pick tests the exact laid label block at
   its D3 anchor (the round-16 dims; node labels never rotate, so
   the test is an AABB in model space) after the shape test misses.
   Constants or `case` mappers, `FLAG_TEXT_EVENTS`.  **Edge labels
   stay unpickable** whatever the prop says (edges pick through the
   GPU tile, which draws edge geometry only; the label quads are a
   different stream — a recorded deviation, consistent with the
   round-10 "labels are not pickable" rule).  The label bb term
   already rides `boundingBox({ includeLabels })`, so no bounds work.
4. **Touch gestures port v3's rules verbatim.**  Two-finger cxt: a
   second finger landing within 200 css px of the first starts the
   cxt gesture — `cxttapstart` on the node under finger 1 (else
   finger 2, else the core; the synchronous CPU pick), `cxtdrag`
   (+ `cxtdragover`/`cxtdragout`) while the pair moves, **cancelling
   into a pinch** when the finger distance grows past 1.5× or 150 px
   (`cxttapend` fires, then the pinch machinery takes over),
   `cxttapend` + `cxttap` (when never dragged) on release.  A
   two-finger press *farther* than 200 px apart pinches immediately
   (v3's threshold).  Three-finger box: with `boxSelectionEnabled`,
   three fingers select — the box spans the start centroid to the
   moving centroid (v3's `(f1+f2+f3)/3` corners), `boxstart` on the
   first move, applied through the existing box flow (boxend / box /
   boxselect + the round-16.5 label containment option) when the
   third finger lifts; a gesture that boxed never degrades to a
   pinch (v3's `didSelect` latch).  Both gestures ride the existing
   pointer-event handlers (v4 has no touch-event path by design).
5. **Closed or deferred without building:** `pixelRatio` turned out
   to be **already landed** (ctor option, `'auto' | number`, plumbed
   to the renderer's dpr — this round adds the missing spec + docs
   and records it); a box-selection **overlap mode** is *not* v3
   surface (v3 selects by containment) and is **deferred as a
   demand-gated hook** — the logged shape is a
   `boxSelectionMode: 'contain' | 'overlap'` core option whose
   overlap test is bb-intersect for nodes and segment/route-vs-rect
   for edges (the cull pass already owns that math).

**Pass split** (tests-first per item; docs in-commit):

- [x] **20.0 Docs-first** (2026-08-01) — this plan section; gap
  item 8 marked scoped.
- [x] **20.1 The option quartet** (2026-08-01) — `wheelSensitivity`,
  `desktopTapThreshold`, `touchTapThreshold`, `tapholdDuration`:
  ctor options + validated getter/setters on the core (throws on
  non-finite/negative; wheelSensitivity must be > 0 and keeps v3's
  once-per-instance warning on non-default values, from ctor or
  setter), read live by the pointer layer — the wheel exponent
  gains the multiplier (base rate unchanged), press-move thresholds
  resolve per event by pointer type (touch 8 / desktop 4 — v4
  previously used 4 for both), and the taphold timer takes the
  configured duration.  Tests-first: 4 Node specs
  (`test/gpu-interaction-options.mjs`, red then green) for the
  option surface incl. the warn-once rule, and a `webgpu`
  Playwright spec pinning behavior — sensitivity 2 doubles the
  zoom log-ratio of an identical wheel tick; a 6 px desktop
  press-move drags at threshold 4 and taps (position unmoved,
  `tap` fired) at threshold 10; a 350 ms hold fires no `taphold`
  at duration 5000 and fires it at 150.  2179 Node tests,
  typecheck + lint clean.
- [x] **20.2 `events`** (2026-08-01) — the prop lands exactly as
  called: an enum channel on both groups (constants or `case`
  mappers) whose write() maintains `FLAG_NO_EVENTS`; the CPU node
  pick scans past flagged slots (grab/hover/tap fall through to
  what's beneath), the Frame uniform grew a `pickMode` field (18
  floats, one struct for every pass; scene/export leave it 0) and
  both edge cull kernels drop flagged edges in pick mode only; the
  box gesture filters to `interactive()` (which now folds the
  flag); the flags-column dirty span already invalidates the
  pick-tile cache (setFlag no-ops on unchanged bits, so restyles
  don't churn it).  Tests-first: 6 Node specs
  (`test/gpu-events-prop.mjs`, red then green — defaults, readback,
  validation, case-mapper refresh on data writes, the
  elementsInBox-stays-geometric scope note, CPU-pick
  pass-through) and a `webgpu` Playwright spec (a blue `events: no`
  node still wins the pixel but hover *and* a drag pass through to
  the node beneath; a `cy.pick` on an `events: no` edge answers
  null and flips live after a restyle — the same-cursor pick-cache
  pin; the box gesture selects and box-events only the interactive
  elements).  2185 Node tests, 143/143 Playwright, typecheck +
  lint clean.
- [x] **20.3 `text-events`** (2026-08-01) — node-only enum channel
  (constants or `case` mappers) maintaining `FLAG_TEXT_EVENTS`; the
  CPU pick tests the label block box (`store.nodeLabelBox`, the
  round-16.4 laid dims at the D3 anchor — now on the ModelView
  contract) in device px before the body's quick reject, so label
  hits resolve the node for tap/grab/hover alike; `events: 'no'`
  still wins (checked first).  **Call finalized during the pass**
  (the plan draft waffled between parse-inert and throw): the
  edges group **throws** — accepting an inert prop would be a
  silent no-op, against the unknown-keys-throw rule; edge labels
  stay unpickable (recorded).  Also recorded: the label box picks
  even when the label is LOD-faded (labelFadePx is a readability
  threshold, not a pick predicate).  Tests-first: 5 Node specs
  (`test/gpu-text-events.mjs`, red then green — default/readback,
  edges-group throw, case mapper, label-box pick on/off, the
  events-wins rule) and a `webgpu` Playwright spec (a click on the
  label below the node background-taps under the default and
  selects the node under `text-events: 'yes'`).  2190 Node tests,
  typecheck + lint clean.
- [x] **20.4 Two-finger cxt** (2026-08-01) — the v3 split lands in
  the pointer layer's touch bookkeeping: a second finger closer
  than 200 css px starts the cxt gesture (`cxttapstart` on the node
  under finger 1, else finger 2, else the core — the sync CPU
  pick), the pair moving emits `cxtdrag` + `cxtdragover`/`out`
  (via the existing 17.3 drag-hover pick), spreading past 1.5× or
  150 px cancels into a pinch (`cxttapend`, pinch rebased at the
  current spread — no zoom jump), and either finger lifting ends it
  (`cxttapend` + `cxttap` when never dragged, never on
  pointercancel) with the leftover finger inert, like a pinch's.  A
  pair ≥ 200 px apart pinches immediately, so the two existing
  pinch specs' fingers moved to 220 px spacing (they'd have started
  cxt gestures under the new rule — exactly v3's behavior).
  Recorded deviation: `cxtdrag` thresholds on finger-1 movement
  past `touchTapThreshold` (v4's mouse cxt rule) where v3's touch
  cxt fires on any move event.  Pinned in a `webgpu` Playwright
  spec (four synthetic-touch scenarios: close-pair tap on the node
  → exactly cxttapstart/cxttapend/cxttap; parallel background drag
  → cxtdrag, no cxttap, no pinchzoom; spread → cxttapend then
  pinchzoom with the zoom actually rising; far pair → pinch only),
  verified red against the pre-20.4 pointer layer before the
  implementation was restored.  80/80 webgpu Playwright specs,
  2190 Node tests, typecheck + lint clean.
- [x] **20.5 Three-finger box** (2026-08-01) — v3's centroid box on
  the pointer layer: three fingers (with `boxSelectionEnabled`)
  sweep from the start centroid (+1 px seed, v3) to the moving
  centroid, `boxstart` on the first move, the themed DOM box drawn
  live (the overlay/styling shared with the mouse box via a new
  `showBoxRect` helper), applied on any box finger's lift —
  boxend/box/boxselect through `elementsInBox` (so the 16.5 label
  option applies) filtered to `interactive()` (the 20.2 rule), and
  **additive** as v3's touch box is (it never clears the prior
  selection).  The box preempts a pinch in progress (v3's
  touchmove branch order) and the didSelect latch keeps leftover
  fingers inert until all lift.  **Design call, recorded**: a third
  finger landing on an *undragged* cxt pair converts it to the box
  gesture (`cxttapend` first) — pointer events land fingers
  sequentially, so v3's simultaneous three-finger landing has no
  direct v4 equivalent, and without the conversion the gesture
  would be unreachable over close pairs.  An aborted gesture
  (pointercancel) hides the box and selects nothing.  Pinned in a
  `webgpu` Playwright spec (close-pair + third finger →
  cxttapstart/cxttapend then boxstart/boxend/boxselect of exactly
  the swept nodes, zoom + pan byte-unchanged, leftover fingers
  inert; boxSelectionEnabled off → no box events, nothing
  selected), verified red against the pre-20.5 pointer layer.
  81/81 webgpu Playwright specs, 2190 Node tests, typecheck + lint
  clean.
- [x] **20.6 pixelRatio spec + closing docs sweep** (2026-08-01) —
  the `webgpu` spec confirmed the pre-existing option end to end
  (`pixelRatio: 1` → backing store = css size, `2` → doubled, and
  `cy.pick` at css coordinates still resolves the node), so no
  code was needed.  Closing sweep per the standing rule: both docs
  grepped for the round's vocabulary and staleness markers — fixed
  the round-10 deferred list (12c/compounds/z-index/GPU
  layouts/multiline/three-finger entries all stale since their
  rounds landed), trued up both file headers with rounds 19–20,
  and recorded pixelRatio + the touch-box close in their sections.
  **Round 20 is complete**: 2190 Node + 63 module tests, 147
  Playwright specs (webgpu + webgpu-visual — goldens untouched),
  typecheck + lint clean.

**Risks tracked**: Frame-uniform layout change touches every pass
(one struct, asserted by the existing goldens — any misalignment is
loudly visual); pick-cache staleness on `events` writes (spec pins a
flag flip between two picks at the same cursor); touch synthesis
fidelity in Playwright (the pinch spec's synthetic-pointer precedent;
gestures are driven through pointer events, so no Touch APIs needed);
threshold semantics drift (the pointer layer must pick the threshold
by `pointerType` per event, not per instance).

## Design sitting (2026-08-01, third) — animation trims; display/visibility; charts

Three calls taken with the user (quick answers, follow-up expected on
the finer points), scoping rounds 21–23:

1. **v4 animations do not have to match v3, and the queue goes.**
   The per-element animation queue exists to sequence animations —
   which promises already do better (`await a.promise()`); it was
   valuable pre-promises, not now.  v4 drops queueing outright (there
   is no `queue: false` option because there is no queue), and the
   v3 `step` callback stays out (v4 never had it; `onRender` +
   promises cover progress observation).  The rest of the v3 surface
   (`pause`/`progress`/`reverse`/`apply`, style transitions) stays
   **logged open for follow-up** — not built, not dropped.
   Scoped as **round 21**.
2. **`display` and `visibility` both exist — the distinction is
   useful.**  Two tiers with different use cases: structural hiding
   (no space) vs paint-only invisibility (space kept).  The
   motivating cases: **bundled beziers** — structurally hiding a
   bundle member should re-fan its siblings, while making it
   invisible must keep every rank stable (no sibling jump) — and
   **compound nodes** — a display-hidden child leaves its parent's
   auto-bounds, an invisible child still sizes it.  Scoped as
   **round 22**.
3. **Pie/stripe backgrounds: yes — designed as a charts surface.**
   Ported not as v3's 101 numbered props but as a lean list-valued
   `chart` family designed to grow into other chart kinds later
   (the pie hole is a first instance: donuts fall out of the same
   surface).  Scoped as **round 23**.

Gap-list updates: item 9 (animation surface) partially resolved by
call 1 (queue/step decided; controls + transitions remain the open
follow-up); item 11 (display vs visibility) resolved by call 2;
item 3 (pie/stripe) resolved by call 3.

## Round 21 plan — animation queue removal (planned 2026-08-01)

**Signed-off design calls:**

- **No queue, concurrency by channel.**  The manager keeps a set of
  *concurrently running* animations per element (and for the
  viewport) instead of a queue: starting an animation whose channels
  are **disjoint** from every running one's runs it immediately
  alongside them (position tween + opacity fade compose); starting
  one that **overlaps** a running animation's channels stops that
  older animation in place (its promise resolves, values freeze
  where they are, any GPU lease settles) and the new one captures
  from the frozen state — whole-animation eviction, never a
  half-stopped animation.  Sequencing is the caller's job via
  `await a.promise()`.
- `delay` stays (it is part of one animation's timeline, not
  queueing).  `play`/`stop`/`promise`/`playing`/`animated` keep
  their shapes; `stop()` stops every running animation on the
  collection.
- Recorded: this is a deliberate v4 divergence from v3's
  queue-by-default (user-approved 2026-08-01); v3's `queue: false`
  option spelling is rejected (unknown-keys-throw — there is no
  queue to opt out of).

**Pass split** (tests-first; docs in-commit):

- [ ] **21.1** Manager rework (queue → concurrent set + channel
  eviction), Node specs: disjoint channels run concurrently to
  distinct targets; overlapping starts evict (older promise
  resolves, value frozen at eviction, new capture starts there);
  stop() stops all; a GPU-leased animation evicted mid-flight
  settles to the CPU first (browser spec if needed); the
  `queue` option key throws.

## Round 22 plan — display/visibility split (planned 2026-08-01)

**Signed-off design calls:**

1. **`show()`/`hide()` stay the display tier** (structural, element
   state): no draw, no pick, no space — excluded from bb/fit and
   compound auto-bounds (already true) — and, **new**, a hidden
   `bezier`-styled bundle member leaves its bundle: siblings re-fan
   (v3's display semantics; v4 previously kept the rank, which is
   visibility semantics).  Same rule for the per-node loop stagger
   and compound-loop member index.  A hidden *node* needs no bundle
   work: every member of a pair shares both endpoints, so the whole
   bundle disappears together — recorded.
2. **`visibility` is a style prop** (`'visible' | 'hidden'`, both
   groups, default visible, constants or `case` mappers — the v4
   mechanism for per-element variation; there is no element-state
   setter).  Paint-only: an invisible element draws nothing but
   **keeps its space** — bb/fit, compound auto-bounds, layouts and
   bundle ranks all unchanged — and is not pickable, not hoverable,
   not box-selectable (`interactive()` rides `visible()`).
   Ancestor-gated for nodes (v3: descendants of an invisible parent
   are invisible); an edge is additionally invisible while either
   endpoint is (rides the kernels' existing endpoint tests).
3. **Mechanism: one derived bit, one WGSL constant.**  The style
   engine maintains `FLAG_SELF_INVISIBLE`; the store derives
   **`FLAG_DRAWN`** (= effective shown AND no invisibility on self
   or, for nodes, any ancestor) in the same subtree walk that
   maintains effective `FLAG_VISIBLE`.  The WGSL `SHOWN` constant
   redefines from `ALIVE|VISIBLE` to `ALIVE|DRAWN`, so **every**
   cull kernel, vertex shader, depth prepass and glyph/ghost/layer
   stream honors visibility with zero per-kernel edits and zero new
   bindings; CPU picking tests DRAWN; bb/fit/box-geometry scans keep
   testing VISIBLE (space semantics — invisible elements stay in).
4. **Getter semantics** (v3's): `visible()` = drawn (edges fold
   endpoints); `hidden()` its negation; `takesUpSpace()` = the
   display tier alone (shown, whatever the visibility — it may now
   differ from `visible()`); `interactive()` = `visible()` && the
   20.2 events rule.  Readback: `style('visibility')` from the flag.

**Pass split** (tests-first; docs in-commit):

- [ ] **22.1 Store + prop** — FLAG_SELF_INVISIBLE/FLAG_DRAWN,
  the derivation walk, the `visibility` prop
  (parse/readback/mappers/defaults), getter updates.  Node specs:
  readback, ancestor gating, edge-endpoint folding, bb/fit
  inclusion, auto-bounds inclusion, pick exclusion (CPU),
  takesUpSpace vs visible divergence, case-mapper refresh.
- [ ] **22.2 Renderer** — the SHOWN constant flip + pick paths;
  Playwright: an invisible node's pixels vanish while `fit()`
  still frames it (and its label/ghost/overlay vanish with it);
  an invisible edge vanishes with stable siblings; hover/tap pass
  through; pick-cache invalidation on the flag flip (flags column
  — free, spec-pinned).
- [ ] **22.3 Bundle re-fan** — derivePair/deriveLoops skip hidden
  members + the visibility-flip no-op; markPair hooks on hide/show
  of bezier-styled edges.  Node specs on controlPoints(); a
  Playwright/golden pin: hide a 3-bundle's middle member → the
  outer two re-fan; make it invisible → the outer two
  byte-identical.

## Round 23 plan — node charts: pie + stripes (planned 2026-08-01)

v3's 51 + 50 numbered props (`pie-1-background-color` ...
`stripe-16-background-size`) return as a **lean, list-valued chart
family** designed to grow more kinds later — the user's call
(2026-08-01): definitely port, and shape the surface for future
chart types.

**Signed-off design calls:**

1. **The `chart` family** (node-only): `chart`
   (`none | pie | stripes` — the open enum future kinds extend),
   `chart-values` (a number list — a constant array, or the
   `{ data: key }` passthrough reading a **per-element array** from
   the data sidecar, the headline capability: data-driven pies),
   `chart-colors` (a constant color list *or* a named scheme string
   from the mapper DSL's palette table — `'category10'` is the
   default), `chart-size` (fraction or `'N%'` of the node box,
   default 100%), `chart-hole` (0–1 inner cutout — donuts from the
   same surface, v3's `pie-hole` analogue), `chart-start-angle`
   (pie; v3's `pie-start-angle`, default 12 o'clock),
   `chart-direction` (stripes: `horizontal | vertical`) and
   `chart-opacity` (folds into slice alphas, the B1 pattern).
   Values are **absolute fractions of the whole** (v3's percent
   semantics: a sum under 1 leaves unpainted remainder, over 1
   clamps at 1) — no normalize option for now, apps can normalize
   (recorded).  Slice count caps at 16 (v3's N; recorded).
2. **Storage: a chart blob record per element** ([kind, config,
   n, then n × (value, packed rgba)]) in a round-11-compacting blob
   pool behind a packed `node.chartRef` column — colors resolve at
   style-write (constants-only props bake per record).
   `chart-values` via `{ data }` refreshes on writes of the mapped
   key like any mapped channel; every other chart prop is
   constants-only except `chart` itself and `chart-opacity`
   (mapper-capable enums/numbers).
3. **Rendering: in the node FS, SDF-native.**  A `chartRef == 0`
   early-out keeps unused cost ~zero; pie tests the fragment's
   local angle against cumulative stops (start at 12 o'clock,
   clockwise — v3), stripes test the local coordinate; both clip to
   the node's shape SDF and the `chart-size`d box, draw **over**
   fill/gradient/background-images and **under** border/outline
   (v3's order), and AA at slice boundaries analytically.  Charts
   are paint-only: never in bb, never pickable, no cull impact.
4. **Verification**: Node specs (parse/readback/blob/refresh),
   goldens (pie fractions incl. remainder gap + hole + start angle;
   stripes both directions), and a **live v3 parity scene** mapping
   `chart` pies onto v3's `pie-i-*` props (and stripes onto
   `stripe-i-*`) at matching geometry.

**Pass split** (tests-first; docs in-commit):

- [ ] **23.1 Props + model** — parse/validate/readback, the chart
  blob + ref column, the data-passthrough values channel + refresh.
- [ ] **23.2 Render** — FS chart branch (pie + stripes + hole +
  AA), goldens.
- [ ] **23.3 Parity + polish** — live v3 pie/stripe parity scenes,
  `debug/webgpu` toggle, README/PLAN records + closing sweep for
  the three-round arc.
