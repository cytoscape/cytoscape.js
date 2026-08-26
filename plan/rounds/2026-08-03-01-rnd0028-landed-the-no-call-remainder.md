## The no-call remainder

Round 27 is complete apart from 27.8, which is held for a scope call
on which shapes `border-style`/`outline-style` covers.  This round is
the opposite kind of work: the items left in the ledger that need no
design call at all, because the behaviour is already decided and
either implemented-but-unverified or plainly absent.  No API is
invented here and no scope is widened.

**Finding (2026-08-03, precedes this plan) — round 27's shapes have
no CPU-pick coverage, and three specs that look like they provide it
do not.**

Round 27 added three branches to `render/cpu-pick.mts`: the
`cut-rectangle` chamfer (27.2), `insideBarrel` (27.5) and
`insideRoundPolygon` (27.4).  None of them is exercised by any test.
`test/cpu-pick.mjs` — the harness that actually drives the pick
path against the store — stops at round 10's polygon family.

Three specs in `test/shapes-27.mjs` are *named* for picking and
assert something else entirely:

- `'picks by its slanted outline, not its bounding box'` (right-rhomboid)
  → asserts `boundingBox().w === 100`
- `'picks inside the body and outside the cut corners'` (cut-rectangle)
  → asserts `boundingBox().w === 100`
- `'picks inside the body (the rounded field agrees with the sharp one
  there)'` (round-hexagon vs hexagon) → compares two bounding-box widths

All three hold for *every* shape keyword, because the bounding box is
the node box regardless of shape.  Each spec's comment describes the
pick property it means to check — a miss at the cut corner, a hit at
dead centre — and then never calls a pick path.  **Measured, not
assumed**: with the shape under test swapped for `ellipse` (and the
round-vs-sharp pair swapped for ellipse-vs-star), the file still
passes 20/20.  `barrel` has no pick spec at all.

Why this matters beyond the missing assertions: the shapes' whole
correctness argument is that the shader and the CPU replica are **dual
consumers of one description, agreeing by construction** — and only
the shader half is pinned, by round 27's live parity diffs.  The CPU
replica is a separate implementation in a different language, and
27.4 explicitly recorded that `insideRoundPolygon` is **not
affine-invariant** the way the sharp polygons are, so it must test in
device space.  That is the single most breakable property in the
round, and nothing tests it at any zoom.

This is the same failure mode 27.7 caught in its own parity test — a
test that passes with the feature disabled is not evidence — occurring
inside round 27's Node suite rather than its browser suite.  The
generalized rule is now in `AGENTS.md`: it applies to plain unit specs,
not just parity diffs.

**Two smaller items, same no-call character:**

- **`cy.animate({ panBy })`** — the viewport animation accepts `pan`,
  `zoom`, `fit` and `center` (`animation.mts`), but not v3's `panBy`.
  `cy.panBy()` itself exists (`core.mts`).  The semantics are
  unambiguous (target = the pan captured at start, plus the delta), so
  this is mechanical.  Ledger item 12.  *(Landed as 28.2 — and v3
  resolves the delta at creation rather than at start, which is the
  rule v4 kept.)*
- **Ledger drift in item 12 itself** — it lists `cy.window()` as a gap,
  but that method exists (`core.mts`, with a "v3 parity" doc comment),
  and it lists "layout instances as event emitters" as open, when round
  17 *decided* layout instances stay non-emitters (recorded in the
  README's extension-contract section).  Docs only.  *(Fixed in
  28.3, which also narrowed the wire-format entry: `cy.json()` already
  exports graph-level `data`, so only the binary format is in
  question.)*

**Explicitly not in this round** (each needs a call, and saying so is
the point): `border-style`/`outline-style` (27.8's scope call); the
`roundrectangle` alias inconsistency; `cy.gc()` and
`cytoscape.warnings()` (both are "does v4 want this at all", and
compaction already covers gc); and graph-level `data` in the binary
wire format — `cy.json()` already exports it, but `serializeElements`
is elements-only and its output feeds `cy.add()`, which raises whether
adding elements should overwrite the target's `data()`.  Also still
open: the device-side frame cost of round 27's new shader branches
(27.9).

That one was recorded as blocked on hardware, which was
**wrong** — this box has an AMD RX 580, the same device the 2026-08-01
hardware validation pass benchmarked on, and `benchmark:renderer`
reaches it.  It is a measurement nobody has run, not one that cannot be
run here; see the correction in the 27.9 entry.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **28.1 CPU-pick coverage for the round-27 shapes** (2026-08-03) —
  landed, and the controls are the part worth recording: **two of the
  five new specs did not discriminate on their first version**, which
  is the same defect the pass exists to fix, caught this time because
  the control was run before the commit rather than after.
  The specs live in two places by design.

  `test/shapes-27.mjs`
  gets the keyword-level ones, which run the whole public path — the
  sheet compiles, the style engine writes `borderGeom`, `pickNodeAt`
  reads the stored words — and each case is chosen to be a *hit* for
  `rectangle` (or, for the round family, for the sharp counterpart),
  with that control asserted inline in the same spec.  `cy.pick()`
  itself resolves null on a headless instance, so these call the pick
  path directly; that is what the three replaced specs had backed away
  from into `boundingBox()` assertions.

  `test/cpu-pick.mjs` gets the branch-level properties, aimed at
  what is *particular* to each branch rather than at re-checking that
  a shape has an inside: cut-rectangle's chamfer holding at a flat
  8 px as the node grows 100 → 400 px (a size-relative chamfer would
  put the boundary 24 px away) and its explicit `corner-radius` path;
  barrel's height offset capping at 15 px, shown by the *same relative
  point* picking differently at 100 and 600 px tall; and
  `bottom-round-rectangle`'s asymmetry, whose two assertions fail for
  `rectangle` and for `round-rectangle` respectively.

  **The round family's spec is the one that needed rebuilding.**  Its
  point is that `insideRoundPolygon` is not affine-invariant — the
  radius is a device-px length that must scale with the zoom — and the
  first version asserted a miss at a point that was already outside the
  *sharp* hexagon, so it held under both controls.  The rewritten spec
  picks model (-199, -2) on a 400 px round-hexagon: inside the sharp
  polygon, outside the rounded one, and at zoom 2 the case that
  separates the correct 16-device-px radius from the 8 px an unscaled
  cap would give.

  Controls run, each by patching `cpu-pick.mts` and
  re-running: cut-rectangle → plain rectangle (3 specs fail), barrel →
  plain rectangle (2 fail), round-* → the sharp polygon test (2 fail),
  and the radius cap left unscaled by zoom (1 fails — the one written
  for it, and nothing else, which is what a targeted spec should do).
  7 new specs; 2335 Node tests, 63 module tests, typecheck, lint.
  No source changed, so the browser suites are unaffected.
- [x] **28.2 `cy.animate({ panBy })`** (2026-08-03) — landed as
  planned, in `_resolveViewportTargets` beside `fit`/`center`: the
  delta resolves against the pan **at creation**, which is v3's own
  rule (`v3/src/define/animation.mts` normalizes `panBy` against `cy.pan()`
  when the animation is created, not per tick), so by the time the
  tween runs it is an ordinary absolute `pan` target and needs no new
  channel, no new capture path and no interaction with the round-21
  concurrency rules or the round-24.3 controls.
  One ordering detail was worth getting right: `animate()` gated on
  `opts.pan` *before* resolving, so a `panBy` would have slipped past
  a disabled `panningEnabled`.  It now resolves first and gates on the
  resolved target, which is a no-op for every existing path.
  Precedence follows v3's override order — `fit` beats `center` beats
  `panBy` beats `pan` — with one **deliberate deviation, recorded**:
  passing `panBy` and `pan` together throws, where v3 silently
  preferred `panBy`.  The two spell one channel and guessing is the
  kind of thing v4 rejects loudly elsewhere (`queue`, `step`, unknown
  query keys).
  Tests-first: 5 specs in `test/viewport-animation.mjs` (the
  delta; creation-time resolution, pinned by panning away before
  `play()`; the `panningEnabled` gate; the throw; and `fit` winning
  over `panBy`), 4 red before the change.  2340 Node tests, 63 module
  tests, typecheck, lint, JSDoc coverage 100%.  `AnimateOptions` is
  public surface, so `dist/cytoscape.d.ts` is regenerated and
  `npm run test:types:surface` re-run; `dist/cytoscape.d.ts` (v3) is
  untouched.
- [x] **28.3 Ledger drift + closing docs sweep** (2026-08-03) —
  item 12 is rewritten: `cy.window()` and (now) `panBy` move to the
  landed side, layout-instance emitters move to the *decided* side
  (round 17 settled it — it was never a gap), and the wire-format
  entry is narrowed to what is actually missing, since `cy.json()`
  already exports graph-level `data`.  What survives there is three
  entries that each need a call.
  The "Suggested sequencing" summary gains a round-28 paragraph, and
  the standing rule's own warning applies to it as much as ever: it
  is the second place in this file that outlives the work it
  describes.

  The README carries round 28 in its header, records
  `panBy` in the viewport-targets bullet with the pan/panBy deviation,
  records the round-27 shapes' CPU-pick twins in the shape section,
  and its follow-up hooks now list only open design calls.
  Verification for the round as a whole: 2340 Node tests, 63 module
  tests, typecheck, lint, JSDoc coverage 100%, `test:types:surface` with
  the regenerated declarations.  The browser suites were not re-run
  for 28.1 or 28.3 (tests and docs only); 28.2 touches the viewport
  animation path, whose coverage is the Node suite.
  **Round 28 is complete.**
