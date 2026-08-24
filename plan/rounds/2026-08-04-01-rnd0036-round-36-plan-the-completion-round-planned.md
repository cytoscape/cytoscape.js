## Round 36 plan — the completion round (planned 2026-08-04)

Round 35 closed the last item anyone had logged as *worth doing and not
done*.  What is left in this file divides cleanly in two: the twelve
entries of "Open calls for the maintainer", which are decisions and stay
where they are, and a short tail of work that needs **no decision at
all** — a documentation rule that was measured and deferred on timing,
a verification tier that was opened and half-closed, and three
measurements this file promised and never recorded.  This round is that
tail, and it is deliberately the *only* thing in it: no design call is
taken, none is opened, and no public API moves.

**Findings (measured 2026-08-04, before the passes below):**

1. **The `@returns` tail is 58 members, not 63.**  Round 32 measured
   "63 of 276" with the overload-aware scanner and logged it rather than
   building it, on the reasoning that docmaker's per-function shape has
   no return field — so a missing `@returns` is editor hover text where
   a missing `@param` is a hole in the generated docs.  That reasoning
   draws the **gate's** boundary, not the *writing's*: the tag is in
   round 26's standard-tags list, the surface is 100% documented, and
   `@throws` and `@param` are both complete.

   Re-measured against the
   value-returning public members (a member whose signature carries a
   return annotation that is not `void` and not `this`): **206 of 264
   tagged, 58 missing** — `collection.mts` 30, `animation.mts` 11,
   `layout/contract.mts` 7, `core.mts` 5, `viewport.mts` 3, `style.mts`
   2.
2. **The browser-only throw tier was opened and half-closed.**
   `gpu-throw-coverage` classifies 13 sites as needing a device, a
   canvas or a pointer, and round 30.2 pinned **six** of them — the
   `png()`/`jpg()` export guards.  The other seven have never fired in
   any suite in either project: `gpu-context`'s two device-acquisition
   guards, `column-mirror`'s unknown-column guard, `glyph-atlas`'s full
   atlas, `gpu-tween`'s geometry-kind invariant, and `image-decoder`'s
   two.  Round 30's own record says the browser tier "is pinned in the
   `webgpu` Playwright project instead", which is true of the export
   guards and of nothing else.
3. **Three promised measurements were never recorded.**  (a) The
   renderer benchmark's `--layout` mode has been run **once**, on
   2026-08-01, before rounds 27, 34 and 35.  (b) Round 33's own risk
   register says "the round records the wall time of each profile so
   the cost of running it is itself a documented number" — no profile
   wall time is recorded anywhere.  (c) Round 35 measured six
   properties through the bundle and a whole-object `style()`, but
   `benchmark/style.mjs` and `surface.mjs` — the suites whose rows
   exist to notice a regression on exactly that path — have not been
   re-run since the dispatch table landed.
4. **The stranded doc block has happened ten times and the gate catches
   it only by accident.**  A later insertion lands between a block
   comment and the member it documents; the comment silently
   re-attaches to the wrong member.  Rounds 26.1–26.4 found eight by
   reading, and 34.4 and 34.5 found the ninth and tenth — those two
   because the strand happened to leave a member reading as
   *undocumented*, which is what the coverage gate tests.  When the
   displaced comment lands on another documented member instead,
   nothing notices: coverage stays 100% and two members carry each
   other's prose.  That is the case round 26.1's `json()`/`serialize()`
   pair actually was.

**Design calls (round 36) — all four are about scope, and each one
narrows it:**

1. **`@returns` is written, and reported, and *not* gated.**  Round 32's
   boundary is respected exactly as it was drawn: the gate covers what
   docmaker emits (`@param`), and `@returns` gets the
   `gpu-throw-coverage` treatment instead — `auditReturnTags()` prints
   its tally under the coverage report and `--verbose` lists the
   offenders, always exiting 0.  Whether it should ratchet is a policy
   call of exactly the kind open call 8 already holds for test
   coverage, and this round does not take it.
2. **The stranded-comment check reports too, for the same reason** —
   and because it is heuristic in a way the other three audits are not:
   it cannot distinguish a deliberately free-standing narrative comment
   from a displaced doc block.  A gate would need that distinction; a
   report does not.
3. **The seven browser-only throws get specs, which is not open call
   8.**  That call is whether throw coverage becomes a **gate**.
   Writing the specs that make a documented guard fire is the work
   rounds 30.1 and 30.2 already did in both projects, and it needs no
   decision — a guard nothing has ever triggered is not tested.
4. **A re-measurement is a measurement, and is recorded even when it
   moves nothing.**  This file's own history is three corrections of a
   conclusion reached by *not* running something (18.5, 27.9, 15.7 —
   twice the same wrong "no adapter on this box").  Every number this
   round produces lands in the record with the machine and date, and a
   row that reproduces its baseline is reported as reproducing it.

**Pass split** (tests-first where there is code; docs in-commit; each
pass its own commit(s)):

- [x] **36.0 Docs-first** (2026-08-04) — this plan section.
- [x] **36.1 `auditReturnTags()`, reporting-only** (2026-08-04) —
  landed, written before any tag so the tally came from the shipped
  overload-aware scanner.  That mattered immediately: the throwaway scan
  used to scope this round said 58 missing; the shipped audit says
  **63 of 276**, which is round 32's figure *exactly*.  Fifth time a
  hand-rolled scan has produced a wrong count here, and the first time
  the shipped one has reproduced a prior round's number to the element.

  Two extractor pieces were needed because a return annotation is not on
  the same line as the member name in general — `signatureOf()` joins
  forward until the argument list closes, and `returnAnnotation()` walks
  paren depth to the *matching* close, since `( fn: ( a: X ) => Y ): Z`
  has three parens and only the outer one ends the arguments.
  **One bug found by reading the audit's own output rather than by
  running it**: the first cut joined forward from a *field* declaration
  looking for parens, ran into the next method's signature, and reported
  `Animation.lastNow` as returning the prose of the doc comment below
  it.  `CALL_MEMBER_RE` narrows the class-member branch.

  12 fixture specs, and **one of the four controls came back BAD** —
  making `VOID_RETURN_RE` match nothing failed nothing, because two
  fixtures wrote members as one-liners with the comment inline
  (`/** a */ a(): void {}`), a shape the scanner does not match and the
  sources never use.  Vacuous specs, caught by their own control; both
  rewritten, and the four controls now fail 1, 1, 8 and 1.
- [x] **36.2 The 63 `@returns` tags** (2026-08-04) — landed in round
  32's commit shape (`core`/`viewport`, `collection`,
  `animation`/`style`/`contract`), taking the surface to **276/276**.
  A description, not a type restatement.

  What they carry that the
  annotation cannot: the first-element rule and its undefined case
  (`label()` answers `''` for an unlabelled element and undefined for an
  empty collection — different facts); the readers that answer the
  *effective* value rather than the declared one (`effectiveOpacity` is
  what `transparent()` tests and is not `style('opacity')`; `grabbable`
  reads false for a pannable element while `json()` reports the raw
  field); the predicates that are **not** the negations they look like
  (`inactive` is not `!active`, `isChildless` is not `!isParent`,
  `isOrphan` is not `!isChild`); that `remove()` returns a collection
  which can be *larger* than its receiver and whose refs are dead by
  construction; and that the layout contract's `positions()`/
  `endpoints()` hand back the store's own columns, so they shift under a
  held reference.

  **Two findings inside the pass.**  (a) An *eleventh* stranded doc
  block, and the first of the invisible kind: a complete `arrowBase()`
  block sat above `StyleEngine.lineOpacityConst` with that member's own
  comment beneath it, so the coverage gate could not see it — the
  displaced block landed on another *documented* member rather than
  leaving one bare.  It was **shipping**: `dist/cytoscape.d.ts`
  carried both blocks stacked, so a consumer hovering `lineOpacityConst`
  read a paragraph about arrow colours first.  Round 31.1's defect class,
  live.

  (b) **The `@param` gate had never walked exported functions** —
  `auditParamTags` descended class bodies only, while this script's own
  header defines a public member as a class member "plus every top-level
  exported function".  So `wire.mts` and `columnar.mts` — whose entire
  public surface is exported functions — sat outside a gate reporting
  221/221, and **all three** of wire.mts's exported functions had no
  `@param` at all.  (The 36.2d commit message says "two of the three";
  re-checked against the pre-36.2c tree in the 36.8 verification pass,
  it is three of three.)

  Now 229/229, gated, with a spec that pins the widening rather than the
  count (wire.mts's tally must be non-zero, which it is only while the
  branch exists).
- [x] **36.3 `allAre` and `is`** (2026-08-04) — landed in `surface.mjs`,
  119 rows.  The other three members the audit lists are a constructor
  and two long-form aliases of benchmarked rows, so a row for them would
  time the same function under a second name.
  Both members short-circuit, which is the whole difficulty: the obvious
  spelling of either measures **one** test rather than a hundred — 33.5's
  custom-polygon pick row in a different costume.  The criteria force the
  full walk (allAre matches every element, is matches none) and the row
  labels say so.  Spelled idiomatically per side, which needed a
  `pair()` helper beside `cmp()`/`only()`.

  At N=2000 over a 100-element
  band: allAre 3.75 → 2.30 µs (1.6×), is 6.01 → 2.28 µs (2.6×).
  Collection bench coverage 97.5% → 98.5%.
- [x] **36.4 The seven browser-only throws** (2026-08-04) — landed as
  **four specs and three reclassifications**, which is the honest split.
  Specced: no adapter (the README's own headline for the
  headless/rendered boundary), no webgpu canvas context, no 2d context
  for glyph rasterization (which surfaces on `ready()` because the atlas
  is built during renderer init), and a 404 background image — the one a
  *caller* reaches, whose contract is warn-once-and-render-imageless and
  whose spec asserts `HTTP 404` inside the warning so it pins that guard
  rather than "an image failed somehow".

  Classified UNREACHABLE with reasons: `gpu-context:38` is **shadowed by
  construction** (`_attachFn` checks `navigator.gpu` and then
  synchronously constructs the Renderer, whose ctor calls `init()`, whose
  first statement reads `navigator.gpu` again — nothing can run between
  the two); `column-mirror:113` is a column spec/group mismatch no public
  input chooses; `gpu-tween:408` says so in its own comment, barred one
  layer up by the round-25.1 eligibility rule.
  **A tool bug fell out of the classification**: `browser` and
  `unreachable` counted the same site twice once three sites were in
  both, so the tallies summed past the site total (191 reported as
  176 + 13 + 5).  `unreachable` now wins, as it already did in the
  `--verbose` labels.  Reading: **176 run, 10 browser-only, 5
  unreachable, 0 Node-reachable and never run.**
  Controls: each guard neutered, the bundle rebuilt by hand (an
  http-server *was* on 3333), only that guard's spec re-run — one
  failure apiece, four for four.  172 browser specs (97 `webgpu` + 75
  `visual`), goldens byte-stable.
- [x] **36.5 The three measurements** (2026-08-04) — all three taken, on
  the RX 580 (`amd gcn-4`, dpr 2, 1280×800, render scale pinned to 1)
  and the i9-9900K.
  **(a) `--layout`**, run once before (2026-08-01) and not since rounds
  27, 34 or 35.  v4's `force` converges in **866 ms** (25k×50k),
  **1594 ms** (100k×300k), **759 ms** (ndex, 19.6k×465k), 823 ms
  (curved), 870 ms (images) and — the two round-33.11 scenes that had
  never been run in layout mode at all — 859 ms (wrapped labels) and
  860 ms (half-invisible), while the compound scene settles in
  **14.8 s** on the CPU executor (the 14.11 lease rule).  v3 `cose`
  reports "> 60 s — bailed" on every scene, as it did in the hardware
  pass.

  Against that pass's 697 / 1472 / 952 ms and 15.5 s the rows
  move **+24% / +8% / −20% / −5%** — in both directions, which is the
  reading: nothing in rounds 27–35 touched the layout path, and **these
  rows cannot resolve better than about ±25% by construction**, since
  round 18.3 recorded that GPU trajectories are not bit-stable
  run-to-run (atomic in-cell scatter order), so the iteration count to
  convergence varies.  The two new scenes landing on the flat scene's
  number is the expected result: a layout does not care about labels or
  visibility.  Whole run 10.1 min.

  **Method note, and it changed the numbers**: the first attempt was run
  while this session was also running `test:js`, `tsc` and lint, which
  is CPU contention against a wall-clock convergence measurement.  That
  run was discarded and re-run with nothing else in flight.  A
  benchmark is only as clean as the box it runs on, and this file's own
  standard is that a number nobody can reproduce is a record rather
  than a measurement.
  **(b) The report profiles' wall times**, which round 33's risk
  register promised ("the round records the wall time of each profile
  so the cost of running it is itself a documented number") and no
  round recorded: **quick 7.1 min, `--all` 17.4 min**.

  The runner
  prints its own total, so this was always one run away.  `--full` is
  unmeasured — it adds the 2k/20k/200k matrix and is the profile nobody
  runs casually, which is the point of keeping quick quick.
  **(c) The style getters through the bundle.**  Rounds 34 and 35
  published their headline figures from *throwaway* harnesses, which
  contradicts round 33's design call 2.  `benchmark/style-bundle.mjs`
  is now that source and joins `--all`; it imports
  `build/cytoscape.esm.mjs` and warns when the bundle is older than
  `src/`.

  Running it under `--import tsx` was **measured** to be
  identical rather than assumed safe (the `__name` wrapper is injected
  when esbuild transpiles a `.mts`, and this suite is plain JS importing
  plain-JS bundles), which is what lets it share the report's existing
  spawn.
  Round 35's numbers reproduce — 68 ns at the old sixth case, 53 and 50
  in the middle, 93 and 110 at the back — **and one is refined**: the
  post-table spread is *two populations, not one*.

  A colour-valued read
  builds an `rgb()`/`rgba()` string, which costs about as much again as
  the whole dispatch-and-decode: `background-color` 118 ns and
  `border-color` 116 against `border-width` 64 and `width` 61 — and
  those two colours sat at opposite ends of the old switch, so it is not
  residual positional cost.  `background-color` was the only colour among
  round 35's six, which is why it topped that table and why the
  remaining spread read larger than the dispatch actually is.
- [x] **36.6 The stranded-comment check** (2026-08-04) — landed, and it
  is the round's own finding rather than an item from its plan's
  reasoning.  `auditStrandedComments()` detects the two shapes that are
  detectable statically: a `/**` block whose next non-blank line opens
  **another** `/**` block (only the second documents the member), and a
  block that trails off the end of a class.  It cannot detect the third
  — a block displaced onto a different, also-documented member — because
  the comment attaches to *something* and only a reader knows it is the
  wrong thing; a spec pins that limit so a clean report is not read as
  proof.

  Reporting-only for a second reason beyond round 32's boundary:
  it cannot tell a deliberately free-standing module note from a
  displaced block.

  **Six on the first run**, every one a block orphaned above another:
  `AnimationManager`'s class doc above `GpuTweenSink`'s; the
  `edge.dashPattern` column's above the casing column's — which itself
  sat above `edge.gradient`, so two columns wore the wrong prose and two
  had none; `LabelEntry`'s above `LabelStream`'s; `_query`'s above
  `_allOf`'s, displaced by round 34.2's insertion and invisible to the
  gate because both are `_`-prefixed; the ghost-props set's above the
  font-props set's; and `writeImages`' above `writeChart`'s.  All six
  moved back.  The seventh hit is `curved-edge-pipeline.mts`'s top-of-
  file block, left alone as a module header — the class it describes has
  no doc of its own — and it stays visible in the report as the standing
  count of 1, which is the ambiguity the check reports rather than gates
  on.
  7 fixture specs; three controls failing 2, 1 and 2 — the third came
  back clean the first time and the **control** was at fault, its `sed`
  never having matched (round 31.3's lesson, repeating).
- [x] **36.7 The closing docs sweep** (2026-08-04) — both documents
  swept end to end, plus `AGENTS.md`.
  The README carries round 36 in its header, the `@returns` and widened
  `@param` rules in the JSDoc section, the finished browser tier and the
  corrected tallies in "Measuring the error contract", `style-bundle.mjs`
  in the suite table with the colour-vs-numeric refinement beside round
  35's record, the profile wall times, the re-measured force convergence
  with its ±25% caveat, and a round-36 entry in the follow-up hooks.

  This file gains the round-36 paragraph in "Suggested sequencing" (one
  of the three sites the standing rule names), the pass records above,
  the new files in the directory layout, and an update to **open call 8**
  — the browser tier being finished makes the second part of that call
  smaller, and round 36 declined to gate its own two new audits, which
  keeps the report-only family at three against the gated family's
  three.  The "Needs a call" ledger and "Gaps with direction already
  set" needed nothing: round 36 closes no design call and opens none.

  Two live figures were stale and are trued: the README header's
  "221/221" (now noted as 229/229 since 36.2) and open call 8's "13
  browser-only sites" (10).  The rest of the hits are per-round records,
  which are history and stay as written.
  `AGENTS.md` gains three notes, each earned: a doc block can strand
  onto the *wrong* member and coverage will not notice (with the shipped
  instance); an audit's scope is part of its claim, so check what it
  enumerates before quoting its 100%; and a tool's fixture must be
  written in the shape the tool actually parses, since round 36.1's own
  fixtures were silently skipped and two specs passed with the behaviour
  under test deliberately broken.

  `dist/cytoscape.d.ts` regenerated (1097 doc blocks) — the six
  un-stranded blocks move onto their real members there, which is the
  point of the fix.

**Verification (2026-08-04)**: typecheck, lint, **2663 Node tests**, 97
module tests, **172 browser specs** (97 `webgpu` + 75 `visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types:surface` clean, JSDoc coverage
100%/100%, `@throws` 16/16, `@param` **229/229**, `@returns`
**276/276**, stranded blocks **1** (the module header, by judgement),
and `gpu-throw-coverage` at **176 run / 10 browser-only / 5 unreachable
/ 0 Node-reachable dead**.
**Round 36 is complete.**

**Risks tracked**: a `@returns` description that restates the type adds
noise to the shipped `.d.ts` rather than information (mitigated by
writing what the value *means* — the units, the undefined case, the
first-element rule — which is what the missing ones are missing);
`auditReturnTags` over-detecting on `this`-returning chainables and
setter overloads (excluded explicitly, and the exclusions are specs);
the browser throw specs passing against a **stale bundle**, which is
this repo's standing trap and the reason 27.1's first verification
proved nothing (mitigated by building by hand before every run); and
`--layout` wedging the suite the way it did before 18.5's nested
timeouts existed (they still exist, and `--layout-uncapped` stays
opt-in).
