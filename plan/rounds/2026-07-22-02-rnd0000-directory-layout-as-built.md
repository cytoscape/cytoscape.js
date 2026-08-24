## Directory layout (as built)

```
src/
  index.mts              # default factory cytoscape(options); hard-error gate; wires model↔renderer↔pointer
  public-types.mts          # public option/type surface (RendererOptions LOD knobs, RendererStats, ...)
  core.mts               # Core facade: graph manipulation, queries, events, style(), layout(), pick(),
                         #   batching, compact() (round 19), json()/serialize(), destroy(), width/height
  collection.mts         # Collection ("element is a length-1 collection", v3-style; interned handles;
                         #   epoch-guarded _refs with post-compaction lazy repair, round 19.3)
  viewport.mts           # zoom/pan/panBy/fit/center/extent state + math (core-owned; core emits the events)
  event.mts              # v4's Event object (41.1): typed target, originalEvent, no namespaces
  emitter.mts            # v4's emitter (41.2), replacing the v3 import it had reused
  events.mts             # the one core emitter's wiring: ref/predicate-qualified listeners, the 14.5 phase rules
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
  animation.mts          # Animation + AnimationManager: CPU tween, concurrent per-channel runs (round 21 — no queue); routes position/paint to the GPU sink
  layout/                # grid, preset, circle, concentric, breadthfirst, random
    contract.mts         #   round 17: the extension contract (CustomLayout + the columnar LayoutContext)
    force-sim.mts        #   round 18/59: the CPU reference force simulation (the kernels' spec)
    force-init.mts       #   round 59: components, anchors, the spectral seed, the settle re-pack
    force.mts            #   round 18/59: the built-in force layout (contract consumer; picks the executor)
  algorithms/            # round 10: the full v3 algorithm surface, slot-native over CSR
  shape-points.mts       # unit polygon + arrowhead point tables shared by WGSL gen + CPU pick (round 10;
                         #   round 27 added the round-corner indirection, the compound-arrow parts and
                         #   the computed ARROW_MAX_BACK quad bound)
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
  math.mts               # round 42: the seven generic helpers v4 uses (copied from v3, not shared)
  types.mts              # round 42: Position/BoundingBox — structural types, no runtime exports
  util/                  # round 42: colors.mts, regex.mts, position.mts, sort.mts (v4's own copies)
  contract.mts           # model↔renderer contract: ColumnId specs, flag bits, ModelView, StoreDelta, LabelEntry;
                         #   also the shared field packings (round 27.1: arrow ids, the node shape byte)
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
    gpu-force.mts        # round 18/59: the on-device force integrator (grid/pyramid/gather/apply + lease)
    image-arrays.mts     # round 15: tiered rgba arrays + mips + the r8 icon array + image table
    image-pipeline.mts   # round 15: the image compositing draw (own pass off the node streams)
    chart-pipeline.mts   # round 23: the pie/stripe chart draw (own pass, after images)
    node-layer-pipeline.mts    # round 13 A2: overlay/underlay layer quads
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
debug/                   # the manual harness, rebuilt in round 43:
                         #   networks.js   the fourteen networks: six from real exports (four fixtures
                         #                 shared with v3's WebGL harness under v3/debug/webgl/, the
                         #                 465k-edge ndex-x-large local here, and a clustered variant
                         #                 derived from em-web in-page) + three built in-page
                         #   styles.js     a hand-authored v4 sheet per network + a 'plain' one
                         #   fixtures.js   fixture conversion + the generators (shared with the spec)
                         #   init.js       params, loading, the instance, the stats overlay
                         #   view/layout/toggles/query/events/add-remove.js   the control sections
                         #   slim-ndex.mjs how the 34 MB ndex-x-large fixture was derived
                         #   index.html / style.css / livereload-setup.js   the page itself
                         #   network-ndex-x-large.json   the one fixture that lives here, not in v3/
playwright-page/index.html (+ parity.html for the live v3-vs-v4 diffs)
playwright-tests/renderer.spec.js (+ visual.spec.js + goldens/)
test/*.mjs               # 126 suites picked up by the test:js glob (128 files, less the
                         #   two the glob excludes: types-* and node-test-setup), incl.
                         #   style-readback-all.mjs — round 35.1's characterization of all 153
                         #   readable style props on a node and an edge, the guard the readback
                         #   dispatch table was refactored behind
test/soak/*.mjs          # round 48: the robustness tier, run by `npm run test:soak` under
                         #   --expose-gc (its own script: a leak spec that cannot force a
                         #   collection is a flake generator).  lifecycle.mjs (reachability,
                         #   listeners, the heap backstop), churn.mjs (round 11's sliding
                         #   window, promoted from measurement to gate), wire-fuzz.mjs
                         #   (seeded byte mutations; found three defects on its first run)
                         #   and isolation.mjs (multi-instance; found the fourth)
benchmark/               # 25 suites + the renderer/report/executor-sweep runners (see the Benchmarks section of the README).
                         #   Round 36.5 added style-bundle.mjs — the style getters measured through the
                         #   *built bundle*, giving rounds 34-35's headline figures a re-runnable source.
                         #   Round 33 added layouts, style, load, spatial, data, events, store and
                         #   surface (the breadth pass) to the round-1..29 set, and report.mjs grew
                         #   an --all profile that runs every one of them (closing open call 7).
                         #   Round 60.1 added report-compare.mjs — the cross-run join behind the
                         #   status site's comparison pages (per-row p50 across published runs,
                         #   movers with the frozen-v3 twin as control, whole-run drift).
scripts/bench-coverage.mjs   # round 33.12: which public members a benchmark calls (reports, never gates)
test/modules/bench-coverage.mjs  # round 33.12: that script's matcher, and the limits it errs within
scripts/jsdoc-coverage.mjs   # round 26: the two-tier JSDoc audit (--verbose lists every miss);
                                 #   also @throws accuracy (31.2), @param completeness (32, widened in
                                 #   36.2 to exported functions and again in 37.3 to `export default
                                 #   function`), @returns (36.1, gated since 37.1) and stranded doc
                                 #   blocks (36.6) — the last of which reports, never gates
test/jsdoc-coverage.mjs      # round 26: the coverage gate (no file may regress), + the 31.2/32 rules
test/modules/jsdoc-returns.mjs   # round 36.1: the @returns audit's parser, against a fixture
test/modules/jsdoc-stranded.mjs  # round 36.6: the stranded-block check, and the limits it errs within
scripts/throw-coverage.mjs   # round 30.4: which src throws the Node suite runs; a zero-tolerance
                                 #   gate since 37.1 (npm run test:throws, in the npm test chain), with
                                 #   UNREACHABLE/MISATTRIBUTED as validated allowlists
test/modules/throw-coverage.mjs  # round 30.4: that script's lcov parser, against a fixture; + the 37.1 gate
test/modules/picking.mjs         # the pick tile's packing/unpacking, Node-side
test/modules/wgsl-identifiers.mjs # the shader sources parse as WGSL identifiers (no stale bindings)
test/modules/benchmark-report.mjs # round 33: the HTML report's renderer + stat shaping
test/modules/debug-harness.mjs   # round 43: debug/'s only coverage — every fixture exists at the
                                 #   path the page fetches, and every sheet compiles against it
test/modules/import-graph.mjs    # round 41.3: what src imports from outside itself.  Round 42
                                 #   emptied the allowlist: the rule is now absolute (nothing under
                                 #   src/ may import outside it, nothing may reach into v3/)
scripts/docs-generate.mjs    # round 45: the docs generator — source doc blocks + the
                                 #   `// -- section --` banners -> docmaker's fns shape
                                 #   (`npm run docs:api`; 363 members over 48 sections)
test/docs-generate.mjs           # round 45: the gate — the model cross-checked against the
                                 #   *shipped* dist/cytoscape.d.ts, both directions, plus the
                                 #   stranded-block precondition (gated at zero for published files)
test/modules/docs-generate.mjs   # round 45: that generator's doc-comment parser, against fixtures
test/modules/packaging.mjs   # round 44: the packaging chain — rolldown outputs -> dist:copy ->
                                 #   the manifest -> `npm pack`'s real file list, plus the
                                 #   exports map's conditions (types first, import/require pairing,
                                 #   the legacy fields agreeing, ./gpu resolving to identical files)
test/modules/migration-guide.mjs # round 47: MIGRATING.md's property table checked against the
                                 #   running library — every prop it calls dropped must be
                                 #   rejected, every replacement it offers must compile
MIGRATING.md                 # round 47: the v3 -> v4 porting guide (ships in the package)
CHANGELOG.md                 # round 47: the 4.0 changelog (ships in the package)
rolldown.dts.config.mjs      # round 26.5: rolls src declarations up (build/dts/)
scripts/build-dts.mjs            #   finalizeDts -> dist/cytoscape.d.ts
dist/cytoscape.d.ts          # round 26.5: the shipped declarations behind the package types export
test/types-surface.mjs       # round 26.5: shape audit (exports, statics, surviving doc blocks)
typescript/tests/api.test-d.ts   # round 26.5: compile-only consumer test in the test:types project
v3/                              # round 42: the whole v3 project, self-contained and still buildable —
                                 #   v3/src, v3/test, v3/benchmark, v3/debug, v3/documentation,
                                 #   v3/playwright-{tests,page} (port 3334), v3/package.json and its own
                                 #   build/tsconfig/rolldown configs.  `cd v3 && npm run build`.
```

**Round 42 (2026-08-04) moved all of this.**  The tree above is the
post-move layout: v4's source promoted from `src/gpu/` to `src/`, the
`gpu-`/`webgpu-` prefixes dropped from the test, benchmark, script, debug
and Playwright names, and v3 moved wholesale into `v3/`.  `src/math.mts`,
`src/types.mts` and `src/util/` are new — v4's own lean copies of the five
utility modules 41.3 measured it still importing from v3, so nothing under
`src/` imports outside it.

Where the `gpu-` prefix survives inside `src/`
(`gpu-context.mts` and the `render/gpu-*.mts` trio) it names the *device*
half against a CPU counterpart, which is a live distinction rather than a
v3-era prefix.  `gpu-types.mts` was **not** such a case — it holds the public
option surface — and became `public-types.mts` in round 42.6.
