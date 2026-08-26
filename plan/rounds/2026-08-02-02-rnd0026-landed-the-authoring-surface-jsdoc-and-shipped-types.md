## The authoring surface: JSDoc and shipped types

**Direction taken 2026-08-02 (user).**  The v3 code *and* the v3
documentation stay untouched until v4 actually ships, so every v3
asset remains available for comparison benchmarks and parity work.
The near-term documentation task is therefore **not** a v4 docs
site: it is **JSDoc on the v4 source** — the whole public API, and
ideally every class and every function within it — from which
docmaker input can later be *generated* rather than hand-written.
Nothing in this round changes runtime behaviour or public API
semantics; it is the authoring surface for the docs that come at
release.

**Code investigation (2026-08-02, precedes this plan):**

- Public-member JSDoc coverage across `src` is **395/852 (46%)**
  (audit rule: members of exported classes whose names do not start
  with `_`).  The two files that *are* the public API are the worst
  covered: `collection.mts` 66/204 (32%) and `core.mts` 33/89 (37%).
  `animation.mts` is 33/48 (69%), `viewport.mts` 11/18, and the
  built-in layouts are 0/3 each.
- The comments that exist already **drift**:
  `Collection.animate()` still advertises the pre-round-25
  animatable set (no width/height, edge width, padding or
  font-size).  A JSDoc pass is also a true-up pass.
- The docmaker target shape (`v3/documentation/docmaker.json`) is
  `{ name, descr, formats: [ { descr, args: [ { name, descr } ] } ],
  md }` — a summary sentence, per-overload descriptions and named
  arguments, grouped into named subsections.  Standard JSDoc
  (`@param`, `@returns`, overload blocks) carries all of it.
- Both public classes already carry `// -- <group> --` banner
  comments whose groupings mirror docmaker's subsections almost 1:1
  (24 banners in `collection.mts`, 14 in `core.mts` — "graph
  manipulation", "viewport", "traversal", "events", ...).  So
  section placement needs **no new tag**: the banners already are
  the grouping.
- The `./gpu` package export maps `"import"` only — **no `types`
  key and no `.d.ts`** — and the seven `test:types:*` scripts
  contain zero gpu references, so `import cytoscape from
  'cytoscape'` resolves to untyped JS today.  Pointing the
  existing `rolldown.dts.config.mjs` at `src/index.mts` emits a
  complete 4,508-line / 191 KB declaration bundle in ~300 ms with
  no errors: the declarations are a config addition, not a project.

**Design calls (round 26):**

1. **JSDoc is the documentation source of truth for v4.**  Prose
   about what a member does lives next to the member, not in a
   parallel markdown tree.  `src/README.md` keeps its role —
   scope, design decisions, deviations, the cross-cutting
   narrative — and PLAN.md keeps the logbook; neither duplicates
   per-member documentation.  The eventual release docs are
   *generated* from these comments.
2. **Standard tags only; banners are the sections.**  `@param`,
   `@returns`, `@throws`, `@example`, `@see`, `@defaultValue`.  No
   bespoke `@section`/`@docs` tag: a generator reads the existing
   `// -- <group> --` banners for placement, so this round's job is
   to make the banners complete and consistent rather than to
   invent a vocabulary.  Overloads get one doc block per signature,
   matching docmaker's `formats` array.
3. **A doc comment states the contract, not the implementation.**
   What it does, what it takes, what it returns, what it throws,
   and — where v4 deliberately differs — the deviation, in the
   voice the README already uses ("v3 does X; v4 does Y because
   Z").  Round references (`(19.3)`, `(round 25)`) stay: they are
   how this codebase cites its own history.  Existing comments are
   corrected where they have drifted rather than left beside new
   ones.
4. **Declarations ship with the docs in them.**  `cytoscape`
   gains a real `.d.ts` built by the existing pipeline, so the
   JSDoc written in this round reaches consumers' editors as
   hover text.  This is the payoff that makes the comment pass
   immediately useful instead of only useful at release.
5. **Coverage is enforced, not aspirational.**  The audit becomes
   a checked-in script plus a Node test: the *public API tier*
   (the entry point, `Core`, `Collection`, the animation
   handle, the layout contract and the public style/option types)
   is gated at 100%, and the internal tier is reported with a
   floor that ratchets up as passes land.  Without a gate a
   46%-covered surface silently returns to 46%.

**Pass split** (docs in-commit; each pass its own commit(s)):

- [x] **26.1 The convention + the core surface** (2026-08-02) —
  landed as planned: `scripts/jsdoc-coverage.mjs` (the two-tier
  audit, `--verbose` for the per-member list),
  `test/jsdoc-coverage.mjs` (the completed-files ratchet + the
  tier floors), the conventions recorded in `src/README.md`
  ("Documenting the source"), and `core.mts` 33/89 → **89/89** plus
  `viewport.mts` 11/18 → **18/18**.  Two drift fixes found by
  writing the comments: `json()`'s doc block had become stranded
  above `serialize()` (so `json()` read as undocumented and
  `serialize()` carried the wrong prose), and the batching
  narrative was a bare `/* */` note rather than doc comments on
  `startBatch`/`endBatch`/`batch`.

  Public tier 42.4% → **58.1%**;
  floors set to 58/49.  Typecheck, 2286 Node tests (6 new), 63
  module tests, lint clean.
- [x] **26.2 The collection surface** (2026-08-02) — landed:
  `collection.mts` 66/204 → **204/204**, the largest single surface,
  covering iteration/comparison/set-building, position and
  dimensions, the visibility/selection/grab flag families, traversal
  and edge relations, the whole graph-algorithm surface, degree, and
  the element event methods.  Drift fixed while writing:
  `animate()`'s block still advertised the pre-round-25 animatable
  set (no width/height, edge width, padding or font-size) and said
  nothing about OKLab or the names-only easing rule.

  Contract
  points that had never been written down anywhere a caller would
  look now are: `position()` reads stale under a GPU-owned tween
  while `width()`/`height()` never do (the round-25 geometry-tween
  rule), `boundingBox()` includes labels by default with exact node
  terms and conservative edge terms, `degree()` is singular where
  `totalDegree()` is the collection-wide sum, and `filter()`'s
  query/predicate split is what replaced selector strings.  Public
  tier 58.1% → **92.3%**; floor raised to 92.  Typecheck, 2287 Node
  tests, 63 module tests, lint clean.
- [x] **26.3 Animation, layouts, style, entry points**
  (2026-08-02) — landed: `animation.mts`, `style.mts`,
  `columnar.mts`, `layout/contract.mts` and all seven layouts
  (the six built-ins plus `ForceLayoutImpl`) documented, taking the
  **public API tier to 100%** (408/408).  A third stranded doc block
  surfaced — `setSheet()`'s prose had drifted onto the
  `coreStyle` field below it — the same failure mode as 26.1's
  `json()`, which is now three instances of one pattern: a block
  comment separated from its member by a later insertion.

  The
  audit itself gained three fixes found by running it against real
  code: interface members were being attributed to the class above
  them (`GpuTweenSink.register` counted against `Animation`), prose
  inside `/* */` blocks could parse as a member declaration (the
  style-getter narrative's literal `rgba(...,0);` line), and
  top-level exported functions were not audited at all — adding
  them widened the surface by 8 public and 104 internal members.
  Floors: public 100, internal 58.  Typecheck, 2292 Node tests, 63
  module tests, lint clean.
- [x] **26.4 The internal subsystems** (2026-08-02) — landed:
  `store/`, `render/`, `interact/`, `algorithms/`, `layout/force-sim`
  and the remaining root files, taking the **internal tier to 100%**
  (553/553) and the whole prototype to full public-member coverage.
  Run as four parallel passes over disjoint directories.  ~1,600
  lines of comment across 49 files; the whole change set is
  documentation apart from one safe declaration reorder (moving
  `imagedNodes`/`imageCount()` above the block comment they had been
  pushed below) and four inline-comment corrections.

  Emphasis was on the rules a newcomer gets wrong: dispatch ordering
  and which passes observe which writes (`cull.mts`), what owns a
  buffer while a lease is live and when it must be handed back
  (`gpu-force.mts`), aliasing warnings on every accessor that hands
  out internal state (`outEdges`, `childrenOf`, `ColumnTable.column`,
  `ImageRegistry.get`), the single-consumer drain-per-frame rule that
  makes dirty-span widening safe, `Adjacency.clearNode` clearing only
  the near side so the caller must cascade edges first, `IdMap.idAt`
  being the only place a JS string is materialized, and — a real
  surprise worth writing down — `hierarchicalClustering`'s
  `addDendrogram` option *mutating the graph* (a node plus two edges
  per internal dendrogram node) rather than just reading it.

  **Drift and stranding, the round's recurring find.**  Eight
  stranded doc blocks in total across 26.1–26.4 (`json()`,
  `setSheet()`, the `GraphStore` class doc, `setNodeImages`,
  `boundingBox`, `CurveBlob.free`, `CurveIndex.invalidateRelation`,
  and `collection.animate`'s neighbours) — always the same mechanism:
  a later insertion lands between a block comment and the member it
  documents, so the comment silently re-attaches to the wrong thing
  and the real member reads as undocumented.  Nothing catches this
  but reading, which is the argument for the coverage gate.

  **Eight
  drifted comments corrected** (the tally was corrected from six in
  the 26.6 sweep — see that pass): `boundingBox`'s node-term list
  (outline, overlay/underlay padding, ghost offsets, labels and the
  round-22 space tier had all been added since), `setLabelFont`'s
  "every labelled node" (group-keyed since round 10 — all four label
  streams), `force-sim`'s convergence test naming a non-existent
  `alphaMin` parameter, `curved-arrow-pipeline`'s `endUniforms`
  comment listing two buffers where mid-arrows made it four (round
  13 C1; the straight-arrow twin was already right), the
  glyph-struct comment calling word 13 `pad` when it has carried the
  round-13 D4 end-label param since D4, a `settle()` reference the
  code had renamed to `readPositions()`, `glyph-atlas.setFont`'s
  "no-op when the family is unchanged" (the guard compares family,
  style *and* weight), and — the most consequential —
  `renderer.mts`'s frame-graph header describing the scene pass as
  "edges then nodes then labels, all indirect, **no depth buffer**"
  when there is both a depth target and an early-z node prepass, and
  the real order is prepass → parents → edges/arrows → ghosts →
  bodies → image/chart/overlay → labels.

  A newcomer reading that
  header would have had the frame graph wrong.
  The audit gained overload handling: 26.5's `on`/`one`/`off`
  overloads made their implementation signatures read as
  undocumented members, and an implementation signature is not
  separately documentable — callers only ever see the overloads.
  Coverage gate tightened from a file allowlist to "no file has an
  undocumented public member", now that there is no partial file
  left.  Typecheck, 2285 Node tests, 63 module tests, lint clean.
- [x] **26.5 Shipped declarations for `cytoscape`**
  (2026-08-02) — landed: `rolldown.dts.config.mjs` rolls the
  prototype's declarations up (the existing pipeline, pointed at
  `src/index.mts`), `build-dts.mjs` gained `finalizeGpuDts`
  (the gpu entry is ESM-only — the `./gpu` export has no `require`
  condition — so no export-assignment reshaping is needed, only the
  UMD global name), `build:types` builds both entries, and the
  `./gpu` export gained its `types` key.

  Two tests: the
  `test:types:surface` shape audit (default export, the 37-name type
  surface with no leaks, the three factory statics — expando
  properties a declaration bundler is most likely to drop silently
  — and a floor on the JSDoc blocks reaching the shipped file) and
  `typescript/tests/api.test-d.ts`, a compile-only consumer test in
  the existing `test:types` project.
  **The comment pass pays off here**: 1089 JSDoc blocks reach
  `dist/cytoscape.d.ts`, so round 26's prose is hover text in a
  consumer's editor, not just a source-tree nicety — and the shape
  audit's block-count floor keeps it that way.

  Writing the consumer test found a real type-surface defect the
  audit could not: `cy.on`/`one`/`off` declared their middle
  argument as `ElePredicate | EventHandler`, and a union parameter
  defeats contextual typing — so `cy.on( 'tap', ele => …, cb )`
  gave `ele` an implicit `any` and did not compile under
  `noImplicitAny`.  Split into explicit overloads (types only; the
  implementation signature is unchanged), which also matches design
  call 2: one doc block per signature is exactly docmaker's
  `formats` array.

  Recorded, not fixed: `event.target` is
  `unknown`, because the event object is the shared v3 type and v3
  stays untouched until release; a v4-specific event type would be
  a design call, so consumers narrow it for now.
  Typecheck, lint, and the full `test:types:all` chain clean.
- [x] **26.6 Closing docs sweep** (2026-08-02) — swept both
  documents end to end.

  Fixes: the README header now carries round
  26 and states the standing constraint that v3's code *and*
  `documentation/` stay untouched until v4 ships; the follow-up
  hooks gained a documentation entry that records what deliberately
  stays open (the docmaker generator and the release docs — neither
  built until v4 ships, since `documentation/` is v3's until then)
  plus 26.5's logged `event.target` call; the directory layout
  gained the round's seven new files, which belong to no single
  commit and are exactly what this sweep exists to catch; and
  `AGENTS.md` gained the convention itself under rule 8 — a
  contributor to `src/` now reads that v4 documents itself in
  JSDoc, which tags to use, that the banners are the section
  grouping, that coverage is gated, and that the shipped
  declarations must be regenerated when the surface changes.

  **The round's own record needed correcting**, which is the sweep
  earning its keep: 26.4's entry said six drifted comments where
  the true count was eight, having missed `glyph-atlas.setFont`'s
  guard (family, style *and* weight) and — the one that mattered —
  `renderer.mts`'s frame-graph header describing the scene pass as
  having **no depth buffer** when there is both a depth target and
  an early-z prepass, with the pass order wrong too.  A newcomer
  starting from that header would have had the frame graph wrong.
  `dist/cytoscape.d.ts` regenerated after the final 26.4
  comments: 6,840 lines, 1,091 JSDoc blocks.

  Full verification: typecheck, 2285 Node tests, 63 module tests,
  lint, the whole `test:types:all` chain (including the two new gpu
  audits), and 173/173 Playwright across chromium + webgpu +
  visual (goldens untouched — the round changes no pixels;
  the webkit projects still cannot launch on this box, the same
  host-library environment gap recorded in round 25.7).
  **Round 26 is complete.**
