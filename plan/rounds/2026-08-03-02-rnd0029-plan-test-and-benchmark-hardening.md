## Test and benchmark hardening

Round 28 closed the ledger's no-call remainder.  This round comes from
a different question — *not* "what is unbuilt" but "what is unpinned":
a survey of `src` (49k lines; 121 Node spec files and 14 benchmark
suites at the time — 123 and 15 after this round) for behaviour that
exists, is documented, and is measured or asserted by nothing.

**Survey method and what it ruled out**, since the negative results are
worth as much as the findings:

- **Module-level coverage is not the gap.**  Mapping every `src`
  module to test files that import it shows ~50 with no direct
  importer, but almost all of those (the algorithms, the layouts,
  `core`/`collection` themselves) are exercised through the public
  entry point, which is the right way round.  Nothing was added on
  this basis.
- **The round-27 vacuous-spec defect looks isolated.**  A scan of all
  121 gpu spec files for specs that assert nothing, or whose name
  promises a behaviour their body never invokes, produced 64 hits and
  **no new real ones** — the `NO EXPECT` hits are helper-wrapped
  assertions (`close()` in `test/curve-geometry.mjs`, the `throws()`
  helpers in `test/mappers.mjs`) and the rest are false matches on
  substrings (`betweennessCentrality` contains "tween").  The three
  specs 28.1 fixed remain the only known instances.
- **The binary wire format is already priced** (deserialize ~5 ms,
  ndex-x-large load 106 → 68 ms — the pass-1 record), so the
  serialize/bulk-load benchmark this survey first proposed was
  dropped.

**Findings (as surveyed 2026-08-03, before the passes below).**  Each
was true when written and each is what the matching pass then closed —
read them as the round's starting state, not its current one:

1. **The alias surface is 83 methods wide and 29 of them are never
   called by any test.**  `declare each: this['forEach']` is a *type*
   declaration; the runtime wiring is a separate
   `Collection.prototype.each = Collection.prototype.forEach`
   line.  Deleting a wiring line leaves the typecheck green — the
   `declare` keeps asserting the method exists — and breaks the alias
   at runtime with nothing to catch it.  All 83 are consistent today
   (verified by parsing both sources); the point is that nothing keeps
   them that way.

   Untested ones include `centre`, `deselect`, `each`'s
   siblings `point`/`points`/`modelPosition`/`modelPositions`,
   `renderedCss`, `renderedBoundingbox`, `jpeg`, `invalidateSize`, the
   British spellings (`allAreNeighbours`, `degreeCentralityNormalised`,
   `closenessCentralityNormalised`) and four algorithm aliases.
2. **Four public methods have zero mentions anywhere in the suite**:
   `silentPositions`, `silentShift`, `delayAnimation` and
   `renderedOuterHeight` — the last a plain sibling gap, since
   `renderedOuterWidth` is tested one line away in
   `test/collection-dimensions.mjs`.
3. **The decided-design drops are barely pinned.**  "No selector
   strings, anywhere" is v4's most load-bearing API decision, and the
   only specs asserting it are three in the algorithms files
   (`bfs({ roots: '#a' })` and friends).  Nothing asserts that a
   selector string is rejected by `cy.filter`/`cy.nodes`/`eles.filter`,
   that `cy.$` is absent, that classes are gone, or that `z-index` is
   rejected by the sheet.  A decision that is not pinned is a decision
   that regresses back in by accident.
4. **Curved-edge CPU derivation is unpriced.**  Round 12 benchmarked
   the *GPU* frame cost (the renderer bench's curved pan scene) but
   nothing measures the CPU side: the parallel-edge bundle map, the
   per-edge control-point derivation, the bundle re-fan `show()`/
   `hide()` triggers, the curve-aware accessors, and the curve-hull
   term in bounds and box selection.  That work runs on every endpoint
   move at graph scale, and `curve-geometry.mts` + `curve-index.mts`
   are 2.5k lines of it.
5. **The renderer benchmark has not been run since round 27** — and
   27.9's reason for not running it was wrong (see its correction: this
   box has an RX 580).  The last recorded device numbers are from the
   2026-08-01 hardware pass, before round 27 added shader branches to
   the node and arrow paths.

**Pass split** (tests-first where there is code; docs in-commit):

- [x] **29.1 The alias surface** (2026-08-03) — landed.  91 specs in
  `test/aliases.mjs`: 83 identity checks (the alias exists, is a
  function, and is `===` its target on the prototype), 6 that reach the
  aliases through a live instance (a class field or own property could
  in principle shadow the prototype, which the identity check alone
  would not see), and 2 that cross-check the table against the sources
  in both directions.  All 83 were already consistent — the pass adds
  no fix, it adds the thing that notices.
  Controls: deleting the `each` wiring line fails 2 specs (the identity
  check and the instance check), and declaring an alias that the table
  does not list fails the source cross-check.

  Both were run.
  2431 Node tests, typecheck, lint.  *(Original plan text below.)*

  **29.1 The alias surface.**  One spec file walking an explicit
  table of every alias → target pair, asserting the alias exists, is a
  function, and is identical (`===`) to its target on the prototype,
  plus a meta-check that the two sources declare exactly the tabled
  set — so adding an alias without listing it fails, and deleting a
  wiring line fails.  The table doubles as the written record of the
  alias surface.
- [x] **29.2 The four unmentioned public methods** (2026-08-03) —
  landed, extending the files that already own the surface rather than
  adding a parallel one: `silentPositions`, `silentShift` (both forms)
  and `renderedOuterHeight` in `test/collection-dimensions.mjs`,
  `delayAnimation` in `test/animation.mjs`.  The silent specs assert the
  *silence* — a `position` listener counts zero — and then fire the
  loud sibling in the same spec, so the zero is the method's doing and
  not a listener that was never wired.

  One finding while writing them: `outerHeight()` on a 20 px node with
  a 5 px border is **25, not 30** — v4 keeps v3's outerHalf convention
  under the default centred border position, so half the band lies
  outside.  The first draft of the spec asserted 30 and failed, which
  is the spec doing its job on its first run.
  Controls: making either silent method loud fails its spec, leaving
  `renderedOuterHeight` in model units fails two, and giving
  `delayAnimation` a real channel makes it evict the concurrent
  animation and fails the no-channels spec.
  8 new specs.  *(Original plan text below.)*

  **29.2 The four unmentioned public methods.**  Behavioural specs,
  not smoke: `silentPositions`/`silentShift` must move nodes *without*
  emitting position events (the whole point of "silent"), and
  `delayAnimation` must delay without touching any channel.
- [x] **29.3 Decided drops stay dropped** (2026-08-03) — landed, and
  it turned out to be a *fix* pass as well as a test pass: writing the
  specs found three places where a decided-design removal was accepted
  and then failed somewhere else, or not at all.
  - **Event delegation with a selector string** (`cy.on('tap', 'node',
    cb)`) was wrapped as a predicate without a check, so it registered
    cleanly and then threw `qualifier.fn is not a function` **inside
    the emitter, on the next tap** — during `emit`, so it takes the
    dispatch down with it.  The guard now lives in
    `predicateQualifier`, the one choke point `on`/`one`/`off` share.
  - **A style group written as a function** was **silently ignored**:
    `style: { nodes: ele => ({ ... }) }` compiled to nothing and the
    graph rendered with defaults, no error.  A v3 sheet ported
    wholesale therefore looked like a rendering bug.  `setSheet` now
    throws, naming mappers and `case` as the replacement.
  - **The collection methods** crashed on `other._refs` — or, in
    `same()`'s case, quietly returned `false`, which reads as working
    code.  A shared `assertCollection` guard covers all twelve
    (`same`, `anySame`, `contains`, `allAreNeighbors`, the four set
    ops, `diff`, `indexOf`, `edgesWith`, `edgesTo`).
  Also improved: a selector string reaching `compileQuery` reported
  "Unknown query key '0'" — its own character indices read as keys —
  and now says what actually went wrong.  Every message names the v4
  replacement ($id, a query object, a predicate).
  `test/decided-drops.mjs` then pins the ledger: selector strings
  at every entry point, the absent class methods and `cy.$`, the
  sheet's rejection of `z-index` and the 2026-07-29 triage drops, the
  no-dash shape spellings (with `roundrectangle`'s survival pinned
  *as* the recorded inconsistency, so the line has to change when the
  call is taken), the bypass setter, `json(obj)`, custom easing
  functions, and `queue`/`step`.  16 specs, each citing the ledger
  entry it pins.
  Verification: 2453 Node tests, 63 module tests, typecheck, lint,
  JSDoc 100%, and — because this pass changes source — **87/87 webgpu
  and 75/75 visual against a freshly built bundle** (an
  http-server was already listening on 3333, which is exactly the
  stale-bundle trap, so the build was run by hand first).
  *(Original plan text below.)*

  **29.3 Decided drops stay dropped.**  A spec file pinning the
  design ledger's rejections at the API boundary: selector strings on
  every query entry point, `cy.$`, classes, `z-index` in a sheet, and
  the per-element bypass setter.  Each assertion cites the ledger entry
  it pins.
- [x] **29.4 A curved-edge CPU benchmark** (2026-08-03) — landed as
  `benchmark/curves.mjs`, standalone and gpu-only like
  `labels.mjs`.  Every row runs the same operation on a straight graph
  of identical shape, so the printed number is the **curve premium**;
  the scene is 4 parallel edges per node pair, so an endpoint move
  re-fans a whole bundle.
  **The headline is that curve derivation is deferred to the first
  read**, and the benchmark had to be corrected twice before it showed
  that rather than hiding it.  First: whichever side was measured first
  paid the module's JIT warmup, which inflated the curved side's
  premium (a drag read 2.52× and settled at 1.16× once both sides warm
  up).  Second: two rows came back at ≈1.0×, and rather than report
  "curves are free" the rows were checked — a bulk `positions()` write
  really is free (0.97×: the write defers), but `hide()`/`show()` was
  measuring a flag write, because the bundle re-fan it triggers is
  deferred like every other derivation.  Reading a *sibling* inside the
  loop moved it to 3.79×.
  Numbers at 20k nodes / 40k edges: box selection **3.29×** (the exact
  curve-vs-rect test) — ***wrong, corrected to ~2.3× by round 33.5***:
  the row passed a box object to `cy.elementsInBox`, which takes four
  numbers and answers the empty collection when handed one, so it never
  ran the test it names — re-fan **3.79×** (~5.2 µs per hide/show pair;
  2.66–2.98× on re-measurement, this suite being single-shot rather than
  sampled),
  `controlPoints()` 1.57×, drag 1.46×, first read after a bulk move
  1.46× against 1.22× warm, build 1.18×, exact whole-graph
  `boundingBox()` 1.16×, `midpoint()` 1.15×, conservative `fit()` scan
  1.05×.  Recorded in the README's curved-edge section beside the
  design it prices.
  *(Original plan text below.)*

  **29.4 A curved-edge CPU benchmark** (`benchmark/curves.mjs`),
  standalone and gpu-only like `labels.mjs`: bundled-bezier build,
  node-drag re-derivation at bundle scale, the accessors, bounds and
  box selection over curved edges, and the re-fan triggers — each
  against the straight-edge baseline, so the number reported is the
  *curve premium*, not the ambient cost.
- [x] **29.5 The renderer benchmark on the RX 580** (2026-08-03) —
  run, and it answers 27.9: **round 27's shader branches cost nothing
  measurable per frame.**  Device p50 (timestamp-query, the unbounded
  metric) against the pre-round-27 baseline of 2026-08-01 19:42, same
  box, same flags, four generated 25k × 50k scenes × five passes:
  every stable row moved **+0.3% to +3.6%**, most under +2%.

  The
  label rows sit at the top of that band (+1.5–2.0%), which is the
  expected shape of 27.7's wider glyph instance (`GLYPH_WORDS` 14 → 16,
  64 bytes per glyph instead of 56); the shape and arrow branches are
  invisible.  Wall time is the vsync floor (16.7 ms) on every generated
  scene and view, as before.
  **One row is not a signal, and saying so is the point.**  The
  compound scene's `fit-all` pair first read −29.9% against the
  baseline — far larger than any plausible effect of this round — so
  it was re-measured rather than reported.  A repeat run put the same
  row at 2.11 → 3.00 ms (+42%) with every other row reproducing to
  ±0.02 ms.  The compound `fit-all` device rows are **bimodal
  run-to-run at the ±40% level**; they cannot carry a regression
  claim, and the −30% "improvement" was noise in the other direction.
  Recorded in the README's renderer-benchmark section so the next
  reader does not build on it.
  (The `--layout` mode and the ndex and 100k scenes were not re-run:
  round 27 touched neither layout nor anything scene-size-dependent,
  and the flat/curved/compound/images 25k set is where its node and
  arrow shaders live.)
- [x] **29.6 Closing docs sweep** (2026-08-03) — the README header
  carries round 29; the alias surface is described in the API-scope
  section, the boundary enforcement in the two design-decision bullets
  it belongs to, the curve premium beside the curved-edge design it
  prices, and the renderer bench's noisy rows in the benchmark
  section.  This file's "Suggested sequencing" summary gains the
  round-29 paragraph — the standing rule names it as one of the two
  places that drift every round — and 27.9's "not measured here" now
  points at the answer.

  **Logged, not acted on**: six benchmark suites (`compaction`,
  `labels`, `transitions`, `geometry-tween`, `compound`, and now
  `curves`) are standalone and absent from `report.mjs`'s job table,
  so they only ever run by hand.  That matches how their rounds used
  them — each is a one-round sweep with its own scale — but it does
  mean the HTML report understates what exists.  Worth a decision when
  someone next touches the report.
  **Round 29 is complete.**
