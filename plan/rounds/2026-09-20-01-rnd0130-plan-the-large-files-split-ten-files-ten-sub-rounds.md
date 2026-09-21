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
