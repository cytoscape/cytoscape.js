## The large files split: ten files, ten sub-rounds

Raised by the maintainer on 2026-09-20: `src/` has 18 files at or over
1,000 lines, and the target is files under ~1,000 lines, under 2,000 in
any case.  The round takes the ten largest — `core.mts` and
`collection.mts` (each into its own directory) and the eight from
`style.mts` (9,961) down to `interact/pointer.mts` (1,916) — and lists
the rest for review.  `src/README.md` has carried this as ledger item 26
since round 57, never scheduled, with the constraint that decides the
mechanism: the JSDoc gates (`scripts/jsdoc-coverage.mjs`,
`test/jsdoc-coverage.mjs`, `scripts/docs-generate.mjs`,
`test/docs-generate.mjs`) walk *class bodies* at two-space indentation,
and those doc blocks ship as hover text in `dist/cytoscape.d.ts`.  A
v3-style split onto a prototype would make every moved member invisible
to all four gates while they kept reading 100%.

### The mechanism — the algorithms pattern (the maintainer's call)

`src/collection.mts` already delegates 40 algorithm methods to
`src/algorithms/*.mts`: the class keeps the signature, the JSDoc and a
one-line body, and the implementation is an exported function that takes
the collection first.  Three alternatives were put to the maintainer —
an abstract subclass chain (one class per file, d.ts flattened by the
build), trait classes merged onto the prototype, and this — and the
maintainer chose this one, "the same sort of pattern as for the
algorithms".  Three rules follow from it, applied to every file:

1. **The existing path stays and is the facade.**  Every export it has
   today survives (by re-export where the code moved), so none of the
   ~150 importers, none of the test fixtures that name these paths, the
   `PUBLIC_API` list, `WGSL_FILES` or the alias test changes — only the
   handful of *line*-anchored fixtures listed per sub-round.
2. **The implementation goes in a sibling directory named after the
   file** (`src/style/`, `src/store/graph-store/`, `src/render/renderer/`,
   `src/render/shaders/`, `src/animation/`, `src/curve-geometry/`,
   `src/core/`, `src/collection/`), one file per logical group, as
   exported functions taking the instance first, imported by namespace
   as `core.mts` does for `math`.  The two families that are already
   flat siblings stay flat: `src/layout/force-*.mts`,
   `src/interact/pointer-*.mts`.
3. **Private helper methods move whole; public members keep signature +
   JSDoc and delegate; bodies of ~10 lines that only touch a store or the
   viewport stay.**  A `private` field a moved body reads drops the
   keyword and gains a one-line `@internal` doc — the round-90
   convention — which strips it from the d.ts and keeps it out of the
   public tier.

**Stated at planning: the class facades cannot all reach 2,000 lines
this way.**  The doc blocks stay on the class body because the gates read
them there and they ship as hover text; `collection.mts` is 2,180 lines
of comments before any code.  Estimates at planning: `collection.mts`
≈ 3,400, `core.mts` and `graph-store.mts` ≈ 2,000, the rest under 1,300,
every implementation file under ~900.  The measured sizes are recorded
per sub-round below as each lands.

### The plan

| # | File | Lines | Mechanism |
| --- | --- | --: | --- |
| 130.1 | `src/render/shaders.mts` | 5,220 | re-export facade over `src/render/shaders/` |
| 130.2 | `src/curve-geometry.mts` | 2,166 | re-export facade over `src/curve-geometry/` |
| 130.3 | `src/style.mts` | 9,961 | facade class + `src/style/` |
| 130.4 | `src/collection.mts` | 6,581 | facade class + `src/collection/` |
| 130.5 | `src/store/graph-store.mts` | 5,665 | facade class + `src/store/graph-store/` |
| 130.6 | `src/core.mts` | 3,385 | facade class + `src/core/` |
| 130.7 | `src/render/renderer.mts` | 3,016 | facade class + `src/render/renderer/` |
| 130.8 | `src/animation.mts` | 2,328 | re-export facade over `src/animation/`, one class per file |
| 130.9 | `src/layout/force.mts` | 1,968 | flat `force-*` siblings |
| 130.10 | `src/interact/pointer.mts` | 1,916 | facade class + flat `pointer-*` siblings |
| 130.11 | the record | — | item 26 closed, the summary rewritten |

The two pure-function files go first (lowest risk; they prove the
re-export facade against the gates), then the class hubs largest first.
Each sub-round is one or more isolated commits, each green on
`npm run -s verify`, with `docs/features.csv` re-anchored in the same
commit where the file has line-anchored rows (`collection` 263, `core`
99, `animation` 9; the `style` and `force` rows are file-level), and
`docs/agents/architecture.md`'s `src/` map updated when a directory is
added.

Line-anchored fixtures the split has to follow: `test/modules/wgsl-minify.mjs`
(`WGSL_FILES` and the `Knuth hash decorrelates` read, 130.1);
`test/modules/throw-coverage.mjs`'s `throwLine` anchors on `style.mts`
(130.3) and `renderer.mts` (130.7); `scripts/throw-coverage.mjs`'s
`UNREACHABLE['src/store/graph-store.mts:3219']` (130.5) and
`MISATTRIBUTED['src/render/renderer.mts:154']` (130.7);
`scripts/jsdoc-coverage.mjs` `PUBLIC_API` gains the three animation class
files (130.8).

Verification, every sub-round: `npm run -s verify` after every module
moved; `npm run docs:api` identical to the pre-round output except the
`src` line stamps; `dist/cytoscape.d.ts` identical except demoted
`private` lines disappearing; `test:throws:quiet`, `test:node:quiet`
zero bytes; bundle sizes compared; the collection, mapper and force
benchmark rows against the last published run before closing;
`test:playwright:quiet` after the shader, style, renderer and pointer
sub-rounds.

### 130.1 — `src/render/shaders/`, carried out (2026-09-20)

`shaders.mts` (5,220 lines) is now a 21-line facade re-exporting the
seventeen names it exported before, over nine files: `common` (the
frame struct, `COMMON`, glyphs, boundary, dash — 255 lines), `curve`
(the bezier and route twins of `curve-geometry`, 823), `sdf` (the
generated polygon and arrow SDFs, `SDF`, the node perimeter, 920),
`node` (681), `edge` (864), `arrow` (696), `label` (435), `image` (299),
`chart` (210).  The one-way composition (`FRAME_STRUCT → COMMON → every
shader`; fragments → shaders; the three generators → `SDF` and the arrow
shaders) became sibling imports; `SDF`, `NODE_PERIM_WGSL`, `POLY`,
`ARROW_POLY`, `ARROW_GAP_WGSL`, `END_WALK_WGSL` gained `export` for it.
Every literal kept its `wgsl` tag.  `test/modules/wgsl-minify.mjs` lists
the nine files in `WGSL_FILES` and reads the `Knuth hash decorrelates`
comment from `shaders/common.mts`.  `build/cytoscape.min.js` is
byte-identical to the pre-round build (894,905 bytes) — the minifier
sees the same literals through the re-exports.

### 130.2 — `src/curve-geometry/`, carried out (2026-09-20)

`curve-geometry.mts` (2,166 lines) keeps its round-12a header prose and
re-exports its 57 names from four files: `bezier` (the constants,
bundling, arrow trim, `CurveEval`, `evalCurve`, sampling and deviation —
651 lines), `route` (the round-12b prose, the route constants,
`CurveRoute`, `evalRoute`, endpoint resolution, haystack — 685),
`taxi` (`setRouteBoundary`, `evalTaxi` — 227) and `route-quads`
(corners, bend and quad allocation, `routeVertex`, `flattenRoute`,
`routeMidpoint` — 599).  The seven module scratch objects moved with
the functions that own them.  Two helpers siblings now share —
`qbezier`, `setRouteBoundary` — became documented exports (the internal
tier is gated at 100%, which is how the split found them).  The 146
curve specs and the minified bundle are unchanged.

### 130.3 — `src/style/`, carried out (2026-09-20)

Two commits.  **130.3a** moved the ~6,200 lines of module scope into
thirteen files: `defaults` (507 lines), `tables` (625), `parse` (683),
`parse-edge` (516), `normalize` (39), `apply-prop` (887), `mappable`
(1,041 — the one table over the line; oxfmt's wrapping, one entry per
mapper-capable prop, and splitting a table buys nothing), `compile`
(553), `sheet` (322), `readers` (142) and the 117 `defineReader` calls
as `readers-nodes` (440), `readers-labels` (272) and `readers-edges`
(392), which the facade imports for their side effect ahead of any
read.  Thirty-two helpers that siblings now share became documented
exports — the internal tier's 100% gate is how the split found them.

**130.3b** moved `StyleEngine`'s private groups out as functions over
the engine, with the extractor built on the TypeScript compiler API
(exact member spans, parameter names, body positions): `engine-apply`
(652), `engine-refresh` (412), `engine-read` (541), `engine-write`
(982), `engine-txn` (295), `engine-bypass` (358), `engine-sheet` (428).
Fifty-two private methods left the class; fifteen public and `@internal`
members keep their signature and doc and delegate; twenty private fields
and four private helpers are `@internal` now (the round-90 convention),
which is the only change the shipped d.ts shows.  Two members stay
instance-dispatched on purpose — `write` and `mergeBypass` — because
`test/state-conditions.mjs` and `test/style-bypass.mjs` spy on them
through the prototype to tell the state-refresh fast path from the full
write; the extractor's `viaInstance` list is that rule.
`test/modules/throw-coverage.mjs` anchors its parser fixtures on
`style/parse.mts`, which is also where the file's throws now are.

`style.mts`: 9,961 → **790 lines**.  The docs API JSON is identical
modulo line stamps; the minified bundle is 1.6 kB smaller.

### 130.4 — `src/collection/`, carried out (2026-09-20)

`shared` (the packed ref key, the membership index, the cross-instance
guard, the filter callback types — 109 lines) by the slicer; then 86
methods by the extractor into fifteen modules along the section
banners: `iteration` (189), `filtering` (192), `identity` (205),
`position` (489), `animation` (98), `data` (169), `style` (212),
`bounds` (441), `edge-geometry` (226), `state` (59), `manipulation`
(202), `traversal` (403), `hierarchy` (331), `layout` (244), `degree`
(80).  Thirty-one private helpers left the class (`_positions`,
`_shift`, `_goers`, `_dagAllHops`, `_setSelected` …); the public
members keep signature and doc and delegate through `*Impl` namespace
imports, the `this`-typed ones with an `as this`; `_first`, `_spawn*`,
`_liveRefs`, `_keySet` and `_eventRef` stay as methods because
`src/algorithms/` and `src/layout/` reach them.  Two methods stayed on
purpose: `data()` and `collection()` branch on `arguments.length` (the
round-62.6 hot-read shape), which a delegator cannot forward — the
extractor now refuses any body that reads `arguments`, which is how
this was found (the weighted-centrality specs read `NaN`).  The 263
`features.csv` rows re-anchored by line text (195) or by member (68),
none unresolved.  `scripts/status/feature-inventory.mjs` reads the
readable-prop registries from `style/tables.mts` (a 130.3 loose end
`test:modules` caught — `verify` does not run that tier).

`collection.mts`: 6,581 → **3,870 lines**, of which 2,180 were doc
comments before the round.  The docs API JSON is identical modulo
line stamps; the d.ts now carries `Query` and `DataCondition` with
their doc comments; the Node tier is green.

### 130.5 — `src/store/graph-store/`, carried out (2026-09-20)

`curve-sample` (the exact curved-bounds sampler and its scratch — 49
lines) and `shared` (the compaction rekey, the initial flag word — 64)
by the slicer; 94 methods by the extractor into eleven modules:
`curves` (716), `scan` (746), `compound` (587), `compaction` (294),
`mutation` (649), `layers` (378), `channels` (308), `images` (382),
`labels` (248), `positions` (217), `flags` (182).  Twenty-seven private
helpers left the class; forty private fields (`hierarchy`, `blob`,
`order`, the hot flag views, the label sidecar …) and
`bumpStructureEpoch` are `@internal`; the constructor stays and its
sub-store callbacks call the kept delegators (`setCurveParams`,
`materializeParentGeom`).  Two extractor gaps surfaced here: a
module-scope `const` in the facade was not seen as importable, and a
default-parameter initializer `= this.curveScratch` in a method header
had been rewritten as a static access — both fixed in the tool.
`scripts/throw-coverage.mjs`'s `UNREACHABLE` entry for the `SHAPE_MASK`
invariant is rekeyed to `graph-store/layers.mts:170`.

`graph-store.mts`: 5,665 → **2,279 lines**.  API JSON identical modulo
line stamps; the soak tier and the store specs green.

### 130.6 — `src/core/`, carried out (2026-09-20)

Forty-six methods by the extractor into nine modules: `batching` (250
lines — compaction, `startBatch`/`endBatch`, the style-apply helpers
that share `_batchPending`), `elements` (347 — the add pipeline),
`query` (176), `events` (143 — `on`/`one`/`off` and the compound
bubbling emit), `viewport` (240 — `fit`/`center`/`zoomRange`/
`viewport` and the viewport animation), `export` (95), `graph-data`
(54), `serialize` (171), `lifecycle` (273 — the layout factory, mount,
unmount, device loss, destroy, `_trackRun`).  Nineteen private helpers
left the class; twenty private fields are `_`-prefixed `@internal`;
`_ele`/`_eleFromRef` stay whole as the interned-handle hot path, and
`collection()` because it reads `arguments`.  The module-scope types
and constants (`Layout`, `RendererLike`, `LayoutLike`, the headless
defaults, `AllCache`, `BatchPending`) stay in the facade.  Of the 99
`features.csv` rows, 98 re-anchored by text or member; the one that
pointed into a field's doc block (`cy.ready`) now points at the field.

`core.mts`: 3,385 → **2,218 lines**.  API JSON identical modulo line
stamps; every gate green.

### 130.7 — `src/render/renderer/`, carried out (2026-09-20)

`export-view` (the export scale rule and `resolveExportView`, which the
worker renderer imports through the facade — 103 lines) by the slicer;
38 methods by the extractor into eight modules: `frame` (542 — device
init, the 356-line frame body, the settle timer), `scene` (615 —
`drawScene`, `encodeCulls`), `pick` (311), `export` (325), `force`
(170), `targets` (196), `pipelines` (146 — the nine deferred builders),
`lifecycle` (195 — stats, resize, the DPR listener, destroy).  Thirty
private helpers left the class; ~50 private fields are `@internal`;
`schedule()`, `frame()` and `requestRender()` stay whole (13 call
sites; the loop's spine).  Three extractor rules were born here: a
delegator returns a `Promise<void>` rather than dropping it (the
constructor's `this.ready = this.init()` had lost its rejection —
`test/modules/renderer-resize.mjs` found it as an unhandled rejection);
a removed method whose name a moved body also declares as a local
(`const curvedEdges = this.curvedEdges()`) exports as `<name>Impl`; and
a kept range must start at a doc comment's `/**`, not inside it.  The
`MISATTRIBUTED` throw-coverage key and `test/modules/throw-coverage.mjs`
follow `exportScale` to `renderer/export-view.mts`.

`renderer.mts`: 3,016 → **832 lines**.  Verify, the throw gate and the
renderer module specs green; the visual goldens run after this
sub-round.

### 130.8 — `src/animation/`, carried out (2026-09-20)

The slicer cut the three classes apart — `handle` (122 lines),
`animation` (1,270 before its own extraction), `manager` (570) — with
the channel tables, the write kit and `TWEEN_COL` in `channels` (338);
then the extractor moved `Animation`'s capture (the nine write builders
and ride captures — `capture`, 430) and its apply/finish/`swapEnds`
(`apply`, 140) out, leaving `animation.mts` at 798.  The facade keeps
the module prose and re-exports every name it exported before **except
`buildChannelWrite`**: it is `@internal`, `stripInternal` drops it from
`channels.d.mts`, and a re-export of a stripped name breaks the d.ts
bundle — its one importer (`style/engine-txn.mts`) reaches the module
directly.  `PUBLIC_API` lists the three class files (the
`AnimationHandleImpl → ani` mapping is by class name and unchanged);
`now()` in `manager.mts`, exported for the class, gained the `@returns`
the public tier demands.  Nine `features.csv` rows re-anchored.

`animation.mts`: 2,328 → **62 lines**.  API JSON identical modulo line
stamps; the compile-only consumer type test green; the shipped d.ts is
714 lines shorter across the round so far — the demoted `private`
lines and their docs.

### 130.9 — the `force-*` siblings, carried out (2026-09-20)

The family was flat already, so the file stays flat: the slicer cut
`force-options` (the executor and overlap-mode resolvers, the run
options — 238 lines) and `force-separate` (the tuning constants and
`separateBodies` — 506), and the extractor moved `runOnce` whole to
`force-run` (757 — the 686-line preparation-and-dispatch as one
function over the layout; splitting its closure set further buys
nothing the file limit needs) and the three executors to
`force-executors` (278).  The five private flags are `@internal`.  The
facade re-exports `resolveForceExecutor` and `separateBodies` for their
three specs.

`force.mts`: 1,968 → **263 lines**.  The force specs, the worker spec
and the separation/pack specs green; the bundle unchanged in size.

### 130.10 — the `pointer-*` siblings, carried out (2026-09-20)

Thirty-three methods by the extractor into five flat siblings:
`pointer-handlers` (553 — wheel, down, move, up, cancel, so the class
keeps only its fields, the listener wiring and the small emit/flag
helpers), `pointer-press` (340), `pointer-touch` (325), `pointer-box`
(130), `pointer-hover` (228 — `applyCursor` stays public on the facade
for `test/pointer-cursors.mjs`).  The 26 private fields are documented
bare fields (`PointerHandler` never reaches the d.ts); `src/interact/`
is a `BROWSER_ONLY` prefix so the new files inherit the throw tier.

`pointer.mts`: 1,916 → **540 lines**.  The cursor spec and the gates
green; the pointer gestures are driven in the browser at the close.

### Risks named at planning

- **A moved body that reads a `private` field** is a typecheck error,
  not a silent one — `tsc` is the oracle for which fields to demote.
- **The nanosecond rows** (round 62.5 found a getter chain on them): a
  delegation adds one call, which V8 inlines, but the benchmark decides.
- **`PROP_READERS`** in `style.mts` is a registry filled by 117
  top-level side-effect calls; the split must keep those modules
  imported before `readProp` runs.
- **The WGSL literals** keep their `wgsl` tag and no interpolation inside
  a comment (round 126); the visual goldens are the only proof the
  browser draws the same image.

### The other large files, for the maintainer's review

Not touched this round.  `src/`, 1,000–1,600 lines:
`store/curve-index.mts` 1,555; `render/gpu-force.mts` 1,416;
`style-scales.mts` 1,376; `render/mapper-runtime.mts` 1,190;
`contract.mts` 1,076 (a `test/modules/string-keys.mjs` declaration site
— `DECLARED_IN` must follow a split); `public-types.mts` 1,064;
`algorithms/algo-gpu-cluster.mts` 1,057; `algorithms/algo-kernels.mts`
1,045; `render/cull.mts` 1,026; `taxi-tracks.mts` 1,022.

Outside `src/`: `playwright-tests/renderer.spec.js` 9,579;
`playwright-tests/visual.spec.js` 7,425; `src/README.md` 6,654;
`test/modules/debug-harness.mjs` 1,660; `PLAN.md` 1,601;
`playwright-tests/algorithms-gpu.spec.js` 1,567; `test/force-layout.mjs`
1,508; `EXECUTIVE_SUMMARY.md` 1,359; `test/mappers.mjs` 1,304;
`test/animation.mjs` 1,287; `test/modules/status-site.mjs` 1,134;
`debug/styles.js` 1,105; `scripts/jsdoc-coverage.mjs` 1,101;
`test/layout-quality.mjs` 1,078; `debug/fixtures.js` 1,062;
`test/curve-routes.mjs` 1,029.
