## Round 39 plan — the decided feature tail (planned 2026-08-04)

Three independent small builds, all decided at the fifth sitting.

- [x] **39.1 Overlap box selection** (2026-08-04) — landed, at the
  recorded lean.  `boxSelectionMode: 'contain' | 'overlap'` as a ctor
  option plus a validated getter/setter in the round-20.1 shape; the
  store's `refsInBox` takes the mode, and `GraphStore.edgeHitsBox` is
  the new exact test.  The CPU twin was **extracted, not invented**:
  `segmentHitsBox` in `curve-geometry.mts` is `segmentHitsViewport`
  from `render/cull.mts` line for line, epsilon included, so the
  question box selection asks is the one the cull pass has answered per
  edge per frame since the first cull pass.

  Curved edges take the
  conservative-then-exact shape: the memoized exact bb rejects, and only
  a survivor walks the flattened path at the drawn subdivision.
  **The `elementsInBox` call, taken**: the public query stays pure
  containment and gains no options argument.  The mode is an
  *interaction* preference, so it should not move a programmatic
  caller's results, and the four-numbers signature is a known footgun
  (33.5) that a fifth parameter would deepen.

  Both gesture paths —
  pointer release and the three-finger touch box — go through one
  internal `_elementsInGestureBox` so they cannot drift.
  `boxSelectionIncludesLabels` **reverses sense** with the mode, and the
  docs say why rather than treating it as a special case: containment is
  an AND over an element's parts, overlap an OR, so under 'contain' the
  label must also be inside and under 'overlap' a label crossing the
  band is enough.  That is v3's rule too.
  Not added to `cy.json()`, matching `boxSelectionIncludesLabels`: the
  export mirrors v3's shape, and both of these are v4 inventions.
  Recorded shape difference: **v3 spells this as a per-element style
  prop** (`box-selection`, with a third value `'none'` that v4's
  `events` prop already covers), not a core option.  The sitting chose
  the core-option shape; the difference is worth knowing because the
  ledger described v3 as merely "also offering overlap".
  **Three specs were vacuous and the controls caught all three.**  Every
  overlap spec passed on the first run *with the exact flattened walk
  deliberately removed* — the conservative bb reject was doing all the
  work, so nothing tested the walk.  Two "band inside the bb that the
  path does not reach" specs fix it (one curved, one straight-diagonal),
  and now removing the curved walk, replacing the straight clip with a
  bb test, or dropping the label-widening branch each fails exactly one
  spec.  A fourth near-miss: the benchmark's curved row used
  `curve-style: bezier`, which **bundles multi-edges only** (12a), so on
  a fixture with no parallel pairs it measured straight edges and read
  identical to the row above it — `unbundled-bezier` fixes it, and the
  row now prints how many of its edges are actually curved.
  Costs (`benchmark/spatial.mjs`, N=2000/4000 edges, a band over
  half the graph, 2900–3120 elements caught): overlap is **1.9×**
  containment on straight edges (246 → 470 µs) and **1.9×** on curved
  (968 µs → 1.80 ms), the curved pair dearer on both sides because
  containment already evaluates curve endpoints there.  A `webgpu`
  gesture spec runs the same shift-drag under both modes.
  **The round-37.1 gate fired twice, correctly**: edits to
  `graph-store.mts` and to `wire.mts`'s header comment moved two
  `UNREACHABLE` sites out from under their `file:line` keys, and the
  build failed naming them rather than silently re-pointing the
  exemptions.  That is the failure mode 37.1 was built for, arriving in
  the very next round.
- [x] **39.2 Graph-level data in the wire format** (2026-08-04) —
  landed, at the recorded lean.  Format **version 4**, flag bit
  `F_GRAPH_DATA`, section written last so the element payload keeps the
  byte layout v2/v3 readers expect; older buffers keep loading, and
  nothing branches on the version number — the presence flags carry it,
  which is why they can.  `ColumnarElements` gains an optional `data`,
  `cy.serialize()` fills it (copied, not held by reference — the buffer
  is a snapshot), and `deserializeElements` reads it back.

  **One JSON string, not a column**, and the format's own doc block says
  why: everything else here is per element and scales with the graph,
  while `cy.data()` is a single small object of arbitrary values, so
  columnizing one row would buy a kind-tagged block that says nothing a
  JSON object does not.

  The asymmetry is the round's real decision and both halves are pinned:
  `options.elements` applies graph data (`_bulkAdd`, where the graph's
  own data is still empty), `cy.add( buffer )` drops it.  Each spec was
  run against the other implementation — apply removed, and apply added
  to `add()` — and each failed exactly one spec, so neither is passing by
  accident.  A sixth spec pins the documented escape hatch
  (`cy.data( deserializeElements( buf ).data )`), which is what keeps the
  drop a default rather than a wall, and a seventh pins that a graph with
  no `data()` serializes to **exactly** the byte count it did before this
  round.
- [x] **39.3 `cy.gc()`** (2026-08-04) — landed.  The explicit alias of
  `compact()`: `declare` + prototype wiring, the alias table's 84th row,
  and the doc comment saying why the name is kept rather than merely
  accepted — an upgrading app already types it, and v4 has no separate
  garbage-collection concept for it to name instead (element bytes go
  back to the slot free-list at `remove()`; the slot-stable structures
  self-compact on their own thresholds since round 11).

  `test/decided-drops.mjs` had a spec asserting `cy.gc === undefined`
  alongside `warnings`/`notify`/`noNotifications`; it splits in three —
  `notify`/`noNotifications` stay absent with their reason, `gc` flips to
  pinning the alias, and `cytoscape.warnings` gets its own spec noting it
  is absent *pending round 40*, which is a different kind of absence and
  was previously filed under the same one.
  The alias table's own cross-check earned its keep on the way: the
  `declare` was first written `this[ 'compact' ]` with spaced brackets,
  which the sources-vs-table regex does not match, and the spec failed
  naming the count rather than the graph failing at runtime later.
- Each lands tests-first with docs in-commit; 39.1 adds a `webgpu`
  gesture spec and a spatial-benchmark row (overlap vs contain cost).
- [x] **39.4 Closing docs sweep** (2026-08-04) — both documents plus
  `AGENTS.md`.  The README gains a round-39 line in its header and the
  three closures in the follow-up hooks' round-28 entry; the box-
  selection, wire-format and compaction sections carry the features
  themselves.  This file gains the round-39 paragraph in "Suggested
  sequencing", the pass records, and the three items marked closed in
  "Open calls for the maintainer" (2, the `cy.gc()` half of 4, and 5) —
  each with what the item did not say and the round found out.
  `AGENTS.md`'s benchmark rule gains 39.1's variant: **a fixture can be
  styled into a mode it never enters**, so have a row assert the
  property it is named for.

**Verification (2026-08-04)**: typecheck, lint, **2696 Node tests**, 102
module tests, **173 browser specs** (98 `webgpu` + 75 `visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` clean and `test:types:surface` at 38
type exports / 3 statics / 1104 doc blocks, JSDoc coverage 100%/100%,
`@throws` **18/18**, `@param` **231/231**, `@returns` **278/278**, and
the throw gate green at **177 run / 10 browser-only / 5 unreachable / 0
Node-reachable dead** over 192 sites.

Every new behaviour was run once in the failing direction: three Node
controls on the overlap query, one browser control on the gesture, and
two on the wire format's load asymmetry (each half broken in turn).
**Round 39 is complete.**

**Risks tracked**: overlap box selection is ~1.9× containment and runs
on pointer release, so a very large graph pays it once per gesture
rather than per frame — but it is a *scan*, and the fixture here is
2000 nodes; the 200k profile is unmeasured.  The wire format's version
bump means a v4 buffer read by an older build fails its version check
loudly, which is the intended direction but is a compatibility edge a
release note has to carry (round 47).  And `boxSelectionMode` is a core
option where v3's equivalent is a per-element style prop, so an app
wanting per-element box behaviour has no port path — logged here rather
than in the round record, since it is the shape the sitting chose.
