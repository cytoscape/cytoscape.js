## Round 31 plan — the documented contract (planned 2026-08-03)

Round 30 made v4's throws *fire* in the suite.  This round asks the
next question about the same surface: when they fire, do they say the
right thing — and does the shipped documentation admit they exist at
all?

**Finding 1 (the defect): one error message advises a form v4
rejects.**  `eles.style( name, value )` throws

> Per-element style bypass is not supported in the GPU prototype; use
> the function form of the stylesheet for per-element styling

and its doc comment repeats the advice ("use the fn form of the
stylesheet").  The function form was **removed in round 8** and, since
round 29.3, *throws* at `setSheet` with a message naming mappers as the
replacement.  So a caller who hits the bypass error and follows its
instruction hits a second throw, and the doc comment that ships in
`dist/cytoscape.d.ts` tells them to.  The replacement text already
exists one file over (29.3's message: a `case` mapper for conditionals,
`data(key)` scales for per-element values).
A scan of every other advice-giving message in `src` found no
second instance — the other "use ..." messages name keyword sets and
units that are all still accepted.

**Finding 2: 13 public members throw without an `@throws` tag.**  Round
26 settled that "a doc comment states the contract... what it takes,
what it returns, **what it throws**", and gates *presence* of a doc
comment at 100% — but nothing checks that a member which throws says
so.  17 public members throw; 4 document it.  The 13 that do not
include six of round 20's interaction setters (each throws on invalid
input), `mount()`, `style()` and `numericStyle()`.

*(Corrected by the pass: those figures come from a throwaway scan that
counted `if(` and `for(` as members.  The audit 31.2 actually shipped —
which reuses the round-26 scanner — puts it at **16 members, 7 tagged,
9 added**.  Read the 31.2 record, not this paragraph.)*  These comments are
the shipped `.d.ts` hover text, so the gap is user-visible.

**Finding 3: two events in the curated vocabulary are named by no
test.**  Surveying the round-17 vocabulary against the whole test
corpus: every name appears somewhere except `mouseout` and
`pointercancel`.  `mouseover` is asserted six times in the file whose
sibling `mouseout` is asserted zero — the 29.2/30.3 shape again — and
`pointercancel` is emitted by the pointer layer (17.1) with nothing
pinning it.

**Negative results from the same survey**, recorded so they are not
re-run: **no style prop is unexercised** — all 104 entries of the prop
table are named in `test/`, `playwright-tests/`, `debug/` or
`benchmark/`; and the **event vocabulary is otherwise covered**, though
the first pass of that survey wrongly reported 31 names as untested
because the browser specs register them by looping over an array of
names rather than by literal call sites.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **31.1 The message that recommends a removed form** (2026-08-03)
  — landed.  The throw now reads "Per-element style bypass is not
  supported in v4; per-element styling is declarative: use a 'case'
  mapper for conditionals and 'data(key)' scales for per-element
  values", matching 29.3's wording for the sibling rejection, and the
  doc comment says the same (with a parenthesis recording what it used
  to say, since the old text is what a v3-era app will have been
  following).

  The spec asserts **both halves**, which is what makes it more than a
  string check: the message names a mapper and *does not* name the
  function form, and the form it names is then handed to
  `cytoscape` and expected not to throw.  A message that advises a
  rejected form is only detectable if the advice is executed.
  Control: the old advice restored → the spec fails.
  `dist/cytoscape.d.ts` is regenerated and committed (the comment
  is shipped hover text — the whole reason the defect mattered), and
  `test:types:surface` re-run: 37 type exports, 3 statics, 1093 doc blocks.

  2483 Node tests, typecheck, lint, JSDoc 100%, and — since this pass
  changes source — 91/91 `webgpu` and 75/75 `visual` against a
  freshly built bundle.
- [x] **31.2 `@throws` where a public member throws** (2026-08-03) —
  landed.  The plan said 13 members from a throwaway scan; the audit
  written for the pass, which reuses the round-26 scanner (class-body
  tracking, modifiers, overload signatures, comment skipping) rather
  than a fresh regex, puts it at **16 public members that throw, 7
  tagged** — so **9** comments gained an `@throws`, and the surface is
  now 16/16.
  The nine: `numericStyle`, `mount`, `readProp`, and the six round-20
  interaction setters (`selectionType`, `multiClickDebounceTime`,
  `wheelSensitivity`, and the three thresholds).

  Each states the
  condition rather than the fact — `wheelSensitivity` throws on
  non-*positive* where the thresholds allow 0, and `mount` names its
  three distinct failures — because "throws on bad input" in a comment
  is not worth the line.
  `auditThrowTags()` joins `scripts/jsdoc-coverage.mjs` and its
  tally prints under the coverage report (`--verbose` lists the
  offenders).  It **under-detects deliberately**: a member that throws
  only through a helper it calls is not flagged, because whether that
  is part of *its* contract needs a human.

  **This one is gated**, in `test/jsdoc-coverage.mjs`, where round
  30 deliberately did not gate its throw-coverage measurement — and
  the difference is the reasoning, not an inconsistency: documentation
  completeness is *already* a gated concern here (round 26 made that
  call and took both tiers to 100%), so keeping `@throws` complete
  maintains an existing gate rather than inventing a new kind.  It is
  one `describe` block to remove.

  Controls: a tag deleted → 1 failing; a new undocumented throwing
  member added to `viewport.mts` → 3 failing; the audit's throw
  detection short-circuited → 1 failing (the non-trivial-count guard,
  which exists so a regex change that audits nothing cannot read as a
  pass).
  Comments only in `src/`, so the browser suites are unaffected;
  `dist/cytoscape.d.ts` is regenerated and committed (1093 doc
  blocks).  2485 Node tests, 68 module tests, typecheck, lint.
- [x] **31.3 `mouseout` and `pointercancel`** (2026-08-03) — landed, 2
  specs in the `renderer` project.
  `mouseout` is the plain sibling gap: hover on, assert `mouseover:a`;
  move *within* the node and assert no `mouseout` (the half that makes
  it a hover-boundary test rather than a "some event fired" test);
  move off and assert `mouseout:a`.
  `pointercancel` is driven with **synthetic `PointerEvent`s** rather
  than `page.mouse`, because the handler matches the cancel against the
  press's `pointerId` and only a synthetic event lets the spec choose
  it.

  (`capture()` already swallows the `setPointerCapture` throw that
  inactive synthetic pointers raise, so nothing had to change to make
  this drivable.)  It asserts the recorded 17.2 rule: a cancelled
  gesture **still frees but never reports `dragfree`** — the drag
  aborted rather than completed — plus no `tapend`, the node
  un-grabbed, and, as the precondition that makes the rest mean
  anything, that the gesture really was mid-drag when cancelled.

  **Two of the four controls came back BAD on the first attempt, and
  the cause was the control, not the spec.**  `free`/`freeon` are
  emitted from two places — `onPointerUp` and `onPointerCancel` — with
  identical text, so a string replacement patched the *pointerup*
  copy and the cancel path kept working.  Re-run against the cancel
  block by line, both fail as they should.  Worth recording as a
  method note: when a control edits by string match, check the string
  is unique before believing a BAD result.

  Controls, all four: `mouseout` never emitted → its spec fails;
  `pointercancel` never emitted → 1 fails; the cancel path stops
  freeing → 1 fails; the cancel path also reports `dragfree` → 1
  fails.  93/93 `webgpu` (91 + 2).
- [x] **31.4 Closing docs sweep** (2026-08-03) — the README header
  carries round 31, the JSDoc section gains the `@throws` rule beside
  the round-26 coverage rule, and both records name the thing worth
  remembering: **this file and the README described the bypass
  replacement correctly the entire time.**  The stale advice lived in
  a runtime message and a JSDoc comment, neither of which a markdown
  sweep reads — so "the docs are swept" was true and the shipped
  documentation was still wrong.  `AGENTS.md` says so under the
  JSDoc note, next to the gate that now catches the silent half.
  This file gains the round-31 paragraph in "Suggested sequencing".

  No new open call: 31.2's gating question was answered in the pass
  (documentation completeness is already gated here, so `@throws`
  maintains an existing gate rather than adding a kind), and it is one
  `describe` block to remove if the maintainer disagrees.
  Verification for the round: **2485 Node tests, 68 module tests,
  93/93 `webgpu` and 75/75 `visual` against a freshly built
  bundle, typecheck, lint, `test:types:all` with the regenerated
  `dist/cytoscape.d.ts`, JSDoc coverage 100% and `@throws` 16/16,
  and `gpu-throw-coverage` still at 0 Node-reachable dead sites.**
  **Round 31 is complete.**
