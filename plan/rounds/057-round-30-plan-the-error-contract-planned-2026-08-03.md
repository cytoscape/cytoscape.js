## Round 30 plan — the error contract (planned 2026-08-03)

Round 29 asked what is *unpinned* rather than what is unbuilt, and
worked four answers (the alias surface, four unmentioned methods, the
decided drops, the curve premium).  This round continues that axis on
the part of the surface v4 talks about most and tests least: **what it
throws.**

"Fail loudly" is a stated v4 policy — an unknown sheet key, an unknown
style property, an unknown query key and an unknown `boundingBox()`
option all throw on the reasoning that a typo must not silently do
nothing.  29.3 pinned the *decided-drop* subset of that policy at the
API boundary.  Nothing has ever measured the rest.

**Method, and why the first measurement was wrong.**  Every `throw new`
in `src` was mapped against V8 coverage of the Node suite.  The
first attempt read raw `NODE_V8_COVERAGE` offsets against the `.mts`
sources and reported 47 dead sites — *including* `arrow-scale must be
positive` and `not a valid font-family`, both of which have had throw
specs since round 13.  tsx transpiles before V8 sees the file, so those
offsets belong to the transpiled text and the mapping was fiction.

The
measurement that stands runs the suite under
`--enable-source-maps --experimental-test-coverage --test-reporter=lcov`
and reads source-mapped `DA:` line counts; it puts the two known-tested
sites back in the covered column, which is the check that makes the
rest believable.

**Finding: 191 throw sites in `src`, 34 never executed** by the
2453-test Node suite.  ~20 are Node-testable, ~14 need a browser.  The
list repeats defect shapes rounds 28–29 already named:

- **Sibling gaps** (29.2's `renderedOuterHeight` shape).
  `GraphStore.addEdge` throws on a nonexistent **source** and, four
  lines later, on a nonexistent **target**; only the target throw has
  ever fired in a test.  `renderedSourceEndpoint` is tested;
  `renderedTargetEndpoint` is called by nothing.
- **Decided-drop enforcement, half-pinned** (29.3's own theme, one
  file over).  `bfs`'s options form rejects a selector string and a
  spec pins it; the **positional** form (`bfs('#a')`) rejects it eight
  lines later and nothing fires that.  The `breadthfirst` layout's
  `roots` rejection fires nowhere at all.
- **A README headline, unasserted.**  "the factory throws
  synchronously when `navigator.gpu` is missing" is the first thing
  the README says about headless mode.  `index.mts` checks
  `options.container != null` before touching the DOM, so the throw is
  reachable from Node — and no spec has ever taken it.
- **Public API never called**: `cy.stop()` (the viewport form).  The
  suite calls `ani.stop()` and `ele.stop()` only.
- **Untested public options**: the clustering `distance` metrics
  `squaredEuclidean` and `max` (specs pass `euclidean`, `manhattan`
  and custom functions only).
- **Five `cy.png()`/`jpg()` guards** — invalid `bg`, a `full` export of
  an empty graph, a zero-sized container, a destroyed renderer, an
  invalid `scale` — public contract, browser-testable.
- Style validation (5 parser paths), the wire format's corrupt-buffer
  guards, `mount()`'s two guards, and the `contract.mts` / `table.mts`
  column guards.

**Negative results, recorded so they are not re-run.**

- **All six standalone benchmark suites still run** (`compaction`,
  `labels`, `transitions`, `geometry-tween`, `compound`, `curves` at
  `BENCH_N=2000`, exit 0 apiece).  29.6's open call is about the
  report's job table, not about bit-rot.
- **The public-member survey is clean after 29.1/29.2.**  Re-run over
  406 members of the public sources, the only zero-mention names left
  are renderer-interface internals (`requestRender`, `forceActive`)
  and aliases whose targets are tested.  That axis is harvested.
- **Function-level coverage is not usable here.**  `FN:`/`FNDA:`
  records misattribute one-line arrow lambdas — the style prop
  table's 429 `set`/`default`/`parseEnum` closures report 155 as
  never-called while their props demonstrably round-trip in specs.
  Statement-level (`DA:`) data on multi-line `throw` bodies is sound;
  function-level data is not, and no finding here rests on it.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **30.1 The Node-testable throw sites** (2026-08-03) — landed.
  20 specs across nine files, each in the file that already owns its
  surface (29.2's shape, not a parallel error-test file), and the
  measurement moved **34 never-executed throw sites → 14**.

  Every one
  of the 14 that remain is browser-only (`renderer.mts`'s five export
  guards, `gpu-context`, `column-mirror`, `glyph-atlas`, `gpu-tween`,
  `image-decoder`) or unreachable by design (the SHAPE_MASK field
  invariant; the big-endian platform guard).
  *(Read 15, not 14, from 30.4 onward: `renderer.mts` has a **sixth**
  export guard — `exportScale`'s — which the raw line data reported as
  covered because it sits in a module-level arrow const.  30.4's
  calibration found it and moved it into the browser tier, which is why
  30.2 pins six guards where this entry counts five.)  **Every Node-reachable
  throw in `src` now runs in the Node suite.**
  What landed, by surface: the style parsers' five guards (the wrap
  family's shared keyword closure, gradient stop percents on both
  fills, the image enum shared by five props, the `background-width`/
  `-height` sign check, and the endpoint point form's per-component
  regex); `addEdge`'s source guard and its group-awareness; the two
  column guards of the co-signed contract (`columnSpec` on an unknown
  id, a table asked for the other group's column); the wire format's
  two malformed-input guards; the `closenessCentrality`/
  `degreeCentrality` root preconditions; Karger-Stein's connectivity
  guard; the two selector-string rejections 29.3 missed; the
  headless/rendered boundary's four guards; and `GlyphBuffer`'s stride
  check.
  **Controls were run for all 20** — each guard neutered in place
  (`throw` → `if( false ) throw`), the owning spec re-run, the source
  restored — and **one came back BAD**, which is the pass earning its
  keep.  `cytoscape({ container: {} })` throws with the factory's
  own `navigator.gpu` check deleted, because the renderer attach path
  25 lines below carries an identical check with an identical message.
  The two are not redundant — the early one is a fail-fast *before*
  `new Core`, element ingest and the ctor `layout` run — so the
  spec now pins that ordering: it constructs with a container **and** a
  payload that would itself throw during ingest, and asserts the
  container problem is the one reported.  With the guard restored it
  passes; with it deleted the ingest error surfaces instead and the
  spec fails.
  Two findings worth keeping from writing them: Karger-Stein's
  "connected (sub)graph" throw is **not** a disconnected-graph detector
  (two internally-connected components reach two meta-nodes without
  exhausting the edge list and return a result) — what it catches is a
  contraction that runs dry, which a *subgraph* scope holding nodes
  without their edges reaches; and `breadthfirst` resolves its `roots`
  at `run()`, not at `cy.layout()`, so the first draft of that spec
  asserted a throw from the wrong call.
  No source changed, so the browser suites are unaffected.  2473 Node
  tests (+20), 63 module tests, typecheck, lint.
- [x] **30.2 The image-export guards** (2026-08-03) — landed: 4 specs
  in the `renderer` project covering all **six** throws of the export
  path (the plan said five; `exportScale`'s own guard is a sixth, in a
  module-level helper rather than in `computeExportView`).  These are
  public contract — `bg` and `scale` come straight from the caller, and
  the other four are states a real app reaches: an empty graph, a
  `display: none` container, a figure scaled past the device's texture
  limit, and a destroyed renderer.
  Each spec asserts the **message**, not just the rejection, because
  four of the six live in one method and a bare rejection would not say
  which fired.

  Two carry a control in the same spec that separates the
  guard from "exporting is broken": the empty-graph case pins that the
  *viewport* export of the same empty graph still resolves, and the
  zero-sized-container case pins that the *full* export does — it
  measures the graph, not the container, so the guard is specific to
  the viewport branch.
  Controls: each of the six neutered in `renderer.mts`, the bundle
  rebuilt, the specs re-run — one failure apiece, six for six.
  The bundle was rebuilt by hand before every run: an `http-server` was
  already listening on 3333, which is the stale-bundle trap
  `AGENTS.md` describes, and these specs are worthless against a stale
  bundle.  91/91 webgpu (87 + 4).
- [x] **30.3 The untested public surface** (2026-08-03) — landed, 9
  specs in the three files that own the surfaces.
  **`cy.stop()`** (3 specs, `test/viewport-animation.mjs`): `ani.stop()`
  and `ele.stop()` were tested and the core sibling was called by
  nothing.  Both arms are pinned, since the difference between them is
  the whole point of the argument — the default freezes the viewport
  where the tween reached and it stays there, `stop( true )` applies
  the targets — plus the promise resolving and the idle call being a
  no-op.  One drafting note: the first `viewport` emit can land at
  t = 0, so the specs wait for actual movement rather than for the
  event.

  **`renderedTargetEndpoint`** (1 spec, `test/curve-12c-accessors.mjs`):
  29.2's `renderedOuterHeight` shape exactly — the source twin has been
  tested since 12c.  The spec asserts the transform *and* that the
  answer is the target end, which is what a copy-paste from the
  sibling would break.
  **The clustering metrics** (5 specs, `test/algorithms-clustering.mjs`):
  every existing clustering spec passes `euclidean`, `manhattan` or a
  custom function, so `squaredEuclidean` and `max` — public option
  values — ran nowhere.

  The specs assert the arithmetic through the
  exported `clusteringDistance` (p = (0,0), q = (3,4) separates all
  four metrics: 5, 25, 7, 4) rather than through a clustering run,
  because a run can land on the same partition under several metrics
  and would not notice one silently resolving to another; v3's two
  alternate spellings and the documented silent fallback for an
  unknown name are pinned beside them, with one end-to-end `kMeans`
  spec for the option plumbing.

  Controls: 6 mutations run (stop made a no-op, then made
  always-jump-to-end; `renderedTargetEndpoint` pointed at the source
  end, then at model space; `squaredEuclidean` given the square root,
  `max` made a sum) — each failed the specs written for it.
  2482 Node tests (+9), typecheck, lint.  No source changed.
- [x] **30.4 `scripts/throw-coverage.mjs`** (2026-08-03) — landed,
  mirroring `scripts/jsdoc-coverage.mjs`: run it bare for the
  tallies, `--verbose` for every uncovered site, `--lcov <file>` to
  re-read a report instead of re-running the suite.  It exports
  `audit()` the same way, and it **always exits 0** — a coverage floor
  is a policy call, so the script reports and the decision stays with
  the maintainer.

  Current reading: **191 sites — 176 run by the Node suite, 13
  browser-only, 2 unreachable by design, 0 Node-reachable and never
  run.**
  The classification lists are the useful part and each entry carries
  its reason: `BROWSER_ONLY` (needs a device, a canvas or a pointer —
  pinned in the `renderer` project instead), and `UNREACHABLE` (the
  big-endian platform guard; the SHAPE_MASK field invariant).
  **A third list exists because the tool measured its own error.**
  Line-level lcov attributes the body of a *module-level arrow const*
  to the module-evaluation count, so `exportScale`'s guard in
  `renderer.mts` reads as covered in Node — where there is no renderer
  at all.

  Calibration: of the 14 throw sites under `BROWSER_ONLY`,
  exactly two read as covered, and one of those (`GlyphBuffer.set`)
  genuinely is (a Node spec drives it with a mock device).  So the
  known error is one site in 191; it is listed in `MISATTRIBUTED` with
  the cause, and the script documents that its tally is a **lower
  bound** on dead sites rather than an exact count.  Both footguns the
  round hit are recorded in the file header — the transpiled-offset
  trap that made the first measurement fiction, and the useless
  function-level records.
  5 specs in `test/modules/throw-coverage.mjs` (the precedent is
  `test/modules/benchmark-report.mjs`: a tool's parser gets a fixture, not
  trust) against hand-written lcov naming real files and real throw
  lines.  They pin the three classifications, the misattribution
  override, and that a *silent* report reads as unknown rather than as
  dead — "the file never loaded" is a different failure from "loaded
  and never reached".  Controls: three mutations of the script (dead
  swallowing the browser tier, the override dropped, the DA parser
  broken), each failing its spec.
  68 module tests (+5), lint, typecheck, JSDoc coverage still 100%.
- [x] **30.5 Closing docs sweep** (2026-08-03) — the README header
  carries round 30, a new "Measuring the error contract" section sits
  beside the benchmarks (what the script reports, that it does not
  gate, the reading at the close, and both measurement footguns), and
  the follow-up hooks now name the coverage-floor call alongside the
  other open ones.  This file gains the round-30 paragraph in
  "Suggested sequencing" and open call 8; the status header, which
  still ended at round 23, now runs through 30 and says plainly that
  the ledger's remainder is calls rather than effort.

  **The standing rule caught its own warning again.**  "Suggested
  sequencing" ended with a sentence calling 27.9's device measurement
  "open and blocked on neither — just unrun", written during round 29
  and left standing by *29.6's own sweep*, three paragraphs below
  29.5's record of having run it.  That is the third consecutive round
  in which this one summary is the thing that drifted, which is now
  noted in the paragraph itself.

  `AGENTS.md` gains two testing notes, both earned this round: a guard
  nothing has ever triggered is not tested (with the script that says
  which), and coverage of transpiled sources needs source maps or it
  lies — with the specific traps (raw `NODE_V8_COVERAGE` offsets;
  function-level records on one-line arrows).
  Verification for the round as a whole: **2482 Node tests, 68 module
  tests, 91/91 `webgpu` and 75/75 `visual` against a freshly
  built bundle, typecheck, lint, `test:types:all`, JSDoc coverage
  100%, and `gpu-throw-coverage` at 0 Node-reachable dead sites.**
  **Round 30 is complete.**
