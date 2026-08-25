# WebGPU model + renderer prototype (#3486)

**This file is the development record, not an introduction.**  It is
written in rounds: a plan section per round, a landed section beside it,
and — the part worth reading if you read nothing else — what measurement
said when the round was wrong about itself.  Two shorter documents exist
for the two other jobs: `src/README.md` is the maintained scope and
design-decisions doc, and `EXECUTIVE_SUMMARY.md` is the five-minute
version of this file for someone who will never open it.

**Where the rounds are** (round 108.2): each `##` section of this record
is its own file under **`plan/rounds/`**, named
**`YYYY-MM-DD-NN-rndRRRR-description.md`** — when it was written, a
counter among the sections sharing that date, and the round it is about
(`rnd0000` for the sections that are not rounds) — and indexed in
**`plan/INDEX.md`** (generated — `npm run plan:index`).  This file keeps
only the parts that are *maintained* rather than appended to, which is
what makes it readable in one sitting; the record itself had reached
1.5 MB, past what any reader — and any coding agent — can open.  A new
round is a new file in `plan/rounds/`, then `npm run plan:index`.  The
status site still publishes the whole thing as one page, assembled from
this file plus every section in order.

Two sections here are kept current rather than appended to, and they
are where to start: **"Process"** (the rules every round is held to)
and **"Open calls for the maintainer"** (every question waiting on a
decision, plus the ideas logged for later).

**Status: implemented and evolving** on the `v4` branch (started as
`feature/webgpu`); the base pass was 11 commits, `e30542cf4..9b177c193`.

**What happened, and where to read it** (round 108.4).  This file used to
open here with a round-by-round prose summary of the work.  It is gone,
and its removal is the point rather than a tidy-up: it was a third copy
of a history two better-kept documents already hold, and the only copy
nothing obliged anyone to update.  It had stopped at **round 64** while
44 further rounds landed behind it — so the record opened by summarising
itself up to a point it no longer reached, which is worse than not
summarising itself at all.

- **The five-minute version is [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md)**,
  which `AGENTS.md` requires be rewritten from the record whenever a
  round closes.  That ritual is why it is current and this was not.
- **What a particular round did is in that round's own file**, found
  through `plan/INDEX.md` — generated, so it cannot go stale the way
  prose does.
- **What v4 *is*, as opposed to how it got here, is `src/README.md`** —
  the maintained scope, deviations and design-decisions doc.

Nothing was lost: every sentence the summary carried about a round is in
that round's own file, verbatim since 108.2.

**v4 is not close to a release, and this record is not a route to one.**
The rounds on file are the currently *documented* set, not a plan for
everything v4 needs before 4.0: several rounds are known to be needed
and are not logged yet, and four of the rounds that have shipped — 43,
46.5, 55 and 56 — were each inserted after the sequence they interrupt
was already planned.  Rounds 55 and 56 are the pattern to expect rather
than the exception: both began with a maintainer opening a page and
seeing something no test in this repository could, and both found more
than they set out to fix.

Read "what remains" as an inventory of what
has been written down; it is not an estimate, and a round's absence from
it is not evidence that the work is absent too.

The reason this needs saying at all is that a per-round record reads
optimistically by construction.  Every round closes green, so a file
made of closed rounds reads like a finished thing — and the phrases that
accumulate in it ("the autonomous shelf is clear", "what remains is
calls rather than effort", "v3's arrow vocabulary is complete") were
each true about their own scope and say nothing about the distance to
4.0.  They are kept as written, because each is accurate history; this
paragraph is here so the sum of them is not mistaken for a claim.

`src/README.md` is the maintained scope / deviations doc; the files in
`plan/rounds/` record each round's plan and outcome.

## Process (applies to all work under this plan)

- **Isolated commits as you go.**  Every item lands as its own
  commit(s) with a detailed message — never batch unrelated changes,
  and never leave a round's work sitting uncommitted.
- **Docs travel with the code, every commit.**  Each commit updates
  `src/README.md` (scope / deviations / design decisions) and the
  record — including the logbook: the round records ("Landed (round N)"
  sections and their verification notes) are written or amended in the
  same commit as the work they describe, not batched at the end.
  Since round 108.2 a round's plan and its landed record are **one file**
  in `plan/rounds/`, so amending it is an edit to a small file rather
  than a blind append to a 1.5 MB one; run `npm run plan:index` after
  adding a section, and `test/modules/plan-record.mjs` fails the build if
  the index has drifted.
- **The closing sweep checks `git worktree list`** (rule added 2026-08-24,
  round 108.4).  An agent worktree left behind after a round is not
  harmless: one abandoned tree under `.claude/worktrees/` put 141 of 278
  files into `npm pack` and turned `test:modules` red, because it holds a
  whole second copy of the repo.  Remove a landed round's worktree when
  the round closes.
- **`EXECUTIVE_SUMMARY.md` is rewritten from this file when a round closes**
  (rule added 2026-08-05, round 46.5).  That file is the five-minute version
  for a reader who will never open this one — organised by calendar week, in
  outcomes and decisions rather than rounds and file names.  It is **derived**:
  this file stays the source of truth, and nothing is recorded there that is
  not recorded here first.
  Three things make the rewrite honest rather than mechanical.  **Restate, do
  not append** — a new week is not the only thing that changes, because later
  rounds routinely reveal what an earlier decision actually meant, and the
  z-index and animation-queue entries were both re-described after the fact.
  **Re-measure every number** rather than copying one forward; test tallies,
  member counts and benchmark figures are the first things to go stale, and
  this file has a documented history of sentences that were true when written.
  And **an open question leaves the summary's table when it is decided, not
  when it is scheduled** — the distinction this file's "Open calls for the
  maintainer" section exists to keep.
- **A closing docs sweep ends every round** (rule added 2026-08-01,
  after the post-round-19 sweep caught drift the per-commit rule had
  missed).  Per-commit doc updates track the sections a change
  obviously owns; the long-lived overview sections — the directory
  layout, the follow-up/open-hooks lists, the README header and
  "Follow-up hooks", cross-references like "still open"/"remains" —
  belong to no single commit and drift silently.

  So once a round's
  last item lands, sweep both docs end to end before calling the
  round complete: grep for the round's own vocabulary and for
  staleness markers ("open", "remains", "planned", "not yet", stale
  counts and file lists), verify every section the round touched
  reads true, and land the fixes as the round's closing docs commit.
  **Sweep this file too, not just the README** (amended 2026-08-02,
  after round 27's sweep did the README end to end and left
  PLAN.md's own gap ledger asserting that shape keywords, compound
  arrows and numeric `text-rotation` were still unbuilt — the round
  had just built all three).

  The blocks that drifted worst were the standing summaries of what
  remained — a gap ledger whose per-item "Still open:" lines outlived
  the work that closed them, and a "Gaps with direction already set"
  list that went *seventeen rounds* without a sweep, seven of its eight
  entries still describing landed work as pending and its z-index entry
  still promising to restore `zDepth`/`sortByZIndex` two days after
  z-index was dropped outright.  Those blocks are gone (round 108.4
  took the last of them), which removes the drift by removing the
  duplicate: **what remains** now lives once, in "Open calls for the
  maintainer" below and in `EXECUTIVE_SUMMARY.md`.  Sweep those two.
  A round record is not the whole record.
- **Anything needing the maintainer's decision goes in "Open calls for
  the maintainer"** (section added 2026-08-03), not only into the
  round record that found it.  That covers scope calls *and*
  contradictions — code that disagrees with this file's decided-design
  ledger, which autonomous rounds accumulate.  **Log a contradiction;
  never silently patch it**: removing or keeping public API is the
  maintainer's call even when a ledger entry looks like authorization
  to delete.  Sweep that section with the rest of the file.

## Open calls for the maintainer (kept current)

Rounds 10–29 ran largely autonomously, and some decisions got absorbed
into parity work without a human in the loop.  This section is the one
place those surface: **every open question that needs the maintainer's
call**, with the evidence and what changes once it is answered.  It is
swept with the rest of this file at the end of each round — an item
leaves only when the call is made, and a round that discovers a new
one adds it here rather than burying it in its own record.

Two kinds of entry live here: *scope calls* (work deliberately not
done pending a decision) and **contradictions** — places where the
code and this file's own decided-design ledger disagree, usually
because an autonomous round kept or added something the ledger says
was dropped.  Contradictions are logged, never silently patched:
removing public API is the maintainer's call even when a ledger entry
appears to authorize it.

**2026-08-04 (fifth design sitting): every call below was taken with
the maintainer.**  Each item now carries its decision and the round
that executes it (rounds 37–51, planned in `plan/rounds/`).  The
one question that stays genuinely open is the **error policy** inside
item 4 — the maintainer flagged it for real design work rather than a
quick answer — which converts into round 40's design sitting instead of
closing here.

**Rounds 37, 39, 41 and 42 have since landed** (2026-08-04).  Round 37
executed the four items it owns — item 8 (both audits now gate), item 9
(the alias split), item 10 (constructor strictness at the type layer) and
item 11 (event names stay open, documented).  Round 39 closed items 2 and
5 and the `cy.gc()` half of 4; round 41 closed item 6 and the DOM half of
item 12.

Round 42 closed no ledger item — the packaging decision was the
sitting's, not an open call — but it took two calls its own plan had left
to docs-first (the `gpu-` prefixes drop; the five shared utility modules
duplicate) and a third the plan had not foreseen (the v4 identity rename:
factory, bundles, declaration and UMD global are all `cytoscape` now).
That rename **left the `Gpu*` exported type names behind** — logged as item
13 rather than done, because they are public surface — and the maintainer
took the call the same day, so 42.6 finished it.  Each is marked below, and
the rest still read as described until their rounds ship.

**A second question is now genuinely open**, beside the error policy:
round 41 found that item 12's remaining half — *which* gesture defaults
`preventDefault()` suppresses — cannot be derived from v3 the way the
round-41 plan assumed, because v3 never reads `isDefaultPrevented`
either.  That list is a v4 contract still to be designed.  Round 38 also
acquired three sub-calls, logged inside item 1, that the sitting did not
reach.  Round 42 raised and closed a third (item 13, the `Gpu*` exported
type names) inside the same day, so the count of genuinely open questions
is unchanged at two.

**2026-08-06 (sixth design sitting): the accumulated backlog was swept
with the maintainer.**  Round 38's three sub-calls are taken (item 1 —
the round is unblocked), items 14–16 are ratified as decided design
(item 16's follow-up bounds round is **scheduled as round 54**, before
round 49), round 52's build-step call is taken and its miniray call
logged as item 17, the round-53.1 tween warm-up question joins the
ledger as item 18, and item 12 gains its direction — **explicit gesture
toggles first**; the enumeration holds for 41.5's docs-first.

The
genuinely open questions are now: the **error policy** (round 40, whose
taxonomy-first prep the sitting approved) and the **preventDefault
enumeration** (item 12, direction set), plus the two conditional
entries in items 17–18.  The sitting's record is at the end of this
file.

**2026-08-08: both open questions now have their prep in hand, and
neither is closed.**  Round 40's approved taxonomy-first prep ran —
198 throw sites classified, ~11 demotion candidates in two families,
the measured recommendation in the round-40 section — so its sitting
reacts to a list rather than starting from the sites.  And item 12's
docs-first proposal is written ("Round 41.5 docs-first", at the end of
this file): the toggle map is complete, three of the four tabled rows
are implementable as emitted today, and the `tapstart` → grab row is
recommended dropped because the press handler grabs before it emits.
Each still awaits the maintainer — a sitting for 40, a reaction for
41.5.

**2026-08-09 (seventh design sitting): both are closed, and neither
builds anything.**  The error policy: with the recoverable tier
measured at ~11 sites in two families (GPU acquisition, image export)
and the acquisition half undermined by the missing fallback renderer,
the maintainer chose to **leave the errors thrown — and the warnings
as they are**.  No demotion, no `errorPolicy`, and no
`cytoscape.warnings()`: the fail-loudly contract stands whole, and the
14 `console.warn` sites stay plain warns.  The preventDefault
enumeration: **explicit toggles are the whole gesture-control story**
— `preventDefault()` is browser-level only, permanently, and none of
41.5's four rows is built.  The gesture half of `event.preventDefault`
is now decided design rather than an open half.  With those two taken,
the ledger's genuinely open questions are down to the deferred
`arrow-scale` reserve (item 23) and the conditional tween warm-up
(item 18).  The sitting also scheduled **ledger item 24 as round 58**.

**Two joined later the same day** (2026-08-09, added here by round
60's sweep — round 58's sweep had left item 27 only in the
what-remains amendment, against this section's own rule): **item 27**
(v4's edge underlay/overlay band is `width + 2 × padding` wide where
v3's is `2 × padding` — round 58) and **item 28** (`cy.collection`
silently ignores an argument v3 builds from — round 60).  So the
ledger's genuinely open questions stand at four: 18, 23, 27, 28.

**2026-08-10 (eighth design sitting): ledger item 25 gains its
direction.**  The maintainer reopened the bypass idea ("bypasses are
worth a discussion") and the sitting took four calls: the ergonomics
return as a first-class **`overrides` sheet section** — *not* the
logged case-rewrite spelling, which measurement killed on three walls
— with the v3 method spellings coming back as sugar over it, v3's
bypass-beats-everything precedence, and export as a named section
that sheet swaps replace.  One requirement was set above the rest,
mid-sitting: **the implementation must be fast/performant**.
Design-doc first: the proposal, with its measurements, went to the
end of this file — and **the maintainer approved it the same day with
two amendments** (the section key is `bypasses`, and style prop keys
accept dash-case *and* camelCase everywhere in the API), so it became
the **round-63 plan — which landed the same day** (the records are in
that section).  The genuinely open questions are unchanged at four
(18, 23, 27, 28); item 25 is closed.

**2026-08-10 (ninth design sitting): item 28 closed — throw — plus
two aliases.**  `cy.collection()` throws on any argument (the silent
empty-collection answer was the one method boundary where a typo did
nothing); `cy.$` returns as a plain alias of `filter()` over the v4
query API, in line with `cy.$id()` (selector strings still throw);
and `cy.byId` joins `$id`/`getElementById` for brevity.  All three
landed as **round 64** the same day.  The genuinely open questions
are down to **three: 18, 23, 27**.

### Scope calls

1. **`border-style` / `outline-style`** (27.8, 2026-08-02) — the last
   unported v3 style pair.

   Technique settled, cost known in three
   tiers: circle/rect/round-rect are closed-form (~30 lines);
   ellipse is closed-form but approximate (arc length is elliptic —
   uneven dashes on eccentric ellipses, a recordable deviation); the
   polygon family (the round-* shapes, `barrel`, the custom
   `polygon`) needs the SDF loop to track the argmin edge and a
   cumulative perimeter, roughly
   doubling polygon fragment cost *where a dash is enabled*.  The
   call: ship the cheap subset (a genuine v3 deviation — v3 dashes
   any shape) or cover everything.  `double` is not a dash at all and
   works on every shape either way.
   **Call taken (2026-08-04, fifth sitting): full coverage** — every
   shape, the polygon tier included, its ~2× dashed-polygon fragment
   cost accepted.  Executes as **round 38**.
   **Three sub-calls the sitting did not reach**, found 2026-08-04 by
   reading v3's `drawing-nodes.mts` against v4's style surface while
   scoping the round.  They are logged rather than decided because each
   changes what round 38 *builds*, and the round's own verification
   (live v3 parity diffs per tier) will surface all three as pixel
   differences if they are guessed at:
   - **`double` does not draw a second band in v3 — it erases.**  v3
     strokes the border solid, then re-strokes at `borderWidth / 3`
     under `globalCompositeOperation = 'destination-out'`, which
     removes a middle stripe from *everything already painted*: the
     node's own fill, the edges under it, the background.  So a v3
     `double` border shows the page through the gap, where round 38's
     plan says "a second inner band" — which would show the *fill*
     there.  v4 can reproduce the erase (return alpha 0 for stripe
     fragments in the node FS, since fill and border are one draw), but
     it interacts with the depth prepass, and it is a call, not a
     detail.
   - **`dashed` borders need a pattern.**  v3 reads
     `border-dash-pattern` (default `[4, 2]`) and `border-dash-offset`
     (default 0); v4 has neither, though it has the exact edge
     equivalents (`line-dash-pattern`/`-offset`).  Either the two props
     come with round 38 or `dashed` hardcodes v3's default — parity for
     default styling, a drop for anything else.  Note `outline-style`
     has no such question: v3 hardcodes `[4, 2]` there (and `[1, 1]`
     for `dotted`), taking no props at all.
   - **`border-cap` / `border-join`** are v3 props with no v4
     counterpart, and the SDF band has no natural notion of either —
     dash ends are perpendicular cuts (butt) by construction, which is
     the deviation v4 already records for edge-layer strokes.  Drop
     them explicitly or record the deviation; either way the round
     should say so rather than leave them unmentioned.
   `text-border-style` was already flagged for the round's docs-first
   stage and is unaffected by these.
   **All three sub-calls taken (2026-08-06, sixth sitting) — round 38
   is unblocked:**
   - **`double` ports v3's erase** (alpha-0 stripe fragments — fill and
     border are one draw), with double-bordered nodes excluded from the
     opaque depth prepass on the gradient-fill precedent (they are few,
     and the tier's live parity diff is the gate; the fall-back to an
     inner band exists if the prepass interaction turns out worse than
     expected, in which case the round records the deviation instead).
   - **`border-dash-pattern` / `border-dash-offset` both port** — the
     standard parse/mapper/stored-truth plumbing v4 already has for the
     edge twins, so `dashed` borders are full v3 parity rather than
     default-pattern-only.
   - **`border-cap` / `border-join` drop**, recorded as a deviation
     beside the existing edge-layer butt-cut note (dash ends are
     perpendicular cuts by construction), with rows in the migration
     guide.
   ***Executed — round 38 landed 2026-08-08.***  All three sub-calls
   shipped as specified; the one thing the build reversed was its own
   plan's ellipse approximation (exact arc length instead — the
   deviation could not discriminate; see the round-38 record).
2. **The overlap box-selection mode** (gap item 8) — v4 selects by
   containment only; v3 also offers overlap.  Deferred as a
   demand-gated hook, not v3-surface-critical.
   **Call taken (2026-08-04): build** —
   `boxSelectionMode: 'contain' | 'overlap'` per the logged round-20
   shape (bb-intersect for nodes, segment/route-vs-rect for edges).
   ***Landed as round 39.1 (2026-08-04)** — this item is closed.  Two
   things the item did not say, now recorded: v3 spells the same choice
   as a **per-element style prop** (`box-selection`) rather than a core
   option, and `cy.elementsInBox()` deliberately stays pure containment,
   so the mode is read by the gesture alone.*
3. **Core/collection extension points** (gap item 10) — the layout
   contract landed in round 17; the other two extension categories
   stay out on the reasoning that mappers and predicates cover the
   common cases.  Revisit on demand.
   **Call taken (2026-08-04): stays out** — deferred by decision,
   demand-gated exactly as logged.  Closed; not in the 4.0 scope.
4. **`cy.gc()` and `cytoscape.warnings()`** (gap item 12) — round 19's
   `compact()` answers what `gc` was for, and v4 does warn in several
   places (a deferred `compact()`, a full glyph atlas), so there is
   something for `warnings()` to silence.  The call is whether either
   name survives.
   **Call taken in part (2026-08-04): both names return.**  `cy.gc()`
   lands as the explicit alias of `compact()` (**round 39** —
   ***landed as 39.3, 2026-08-04***);
   `cytoscape.warnings()` builds, but its *shape* is deliberately
   still open — the maintainer flagged the **error policy** itself for
   real design work: v3 mostly avoided throwing because a throw can
   crash an app where ignoring is recoverable, and `warnings()` could
   take options (disable all warnings; demote thrown errors to
   warnings — "the demotion option could be useful... needs more
   discussion and thought").  That question is **round 40's design
   sitting**; this is the one part of the ledger that stays open.
   ***Closed (2026-08-09, seventh sitting): `cytoscape.warnings()` is
   not built after all.***  The taxonomy-first prep measured the
   demotion case at ~11 sites, half of them meaningless without a
   fallback renderer, and the maintainer's call on that evidence was
   to keep **errors and warnings exactly as built** — every throw a
   throw, the 14 warn sites plain `console.warn`, and no global or
   per-instance toggle over either.  The 2026-08-04 "both names
   return" reading is thereby corrected: `cy.gc()` returned (39.3);
   `warnings()` did not.  See the round-40 section for the decision
   record.
5. **Graph-level `data` in the binary wire format** (gap item 12) —
   `cy.json()` already exports it; `serializeElements` is
   elements-only.  Since `cy.serialize()` output feeds `cy.add()`,
   including graph data raises whether adding elements should
   overwrite the target's `data()`.
   **Call taken (2026-08-04): build** — the wire gains a graph-data
   section (format version bump; older buffers keep loading).  The
   add-semantics half is decided at **round 39's** docs-first stage,
   with the lean recorded there: `options.elements` applies graph
   data, `cy.add( buffer )` ignores it (adding elements must not
   clobber the target's `data()`).
   ***Landed as round 39.2 (2026-08-04)** — this item is closed, at that
   lean, with a spec for each half run against the other
   implementation.  Format version 4; the section is one JSON string
   rather than a column, since graph data is a single small object
   where everything else in the format is per element.*
6. **A v4-specific event type** (logged 26.5) — v4 *emitted* the shared
   v3 `Event`, so `event.target` typed as `unknown` in the shipped
   declarations.  A v4 event type is a design call, not an oversight.
   **Call taken (2026-08-04): build the v4 Event** — v4 gets its own
   Event class *and emitter* (severing the last shared-module import
   of v3's `src/emitter.mts`, a prerequisite of the round-42
   restructure): typed `target`, `originalEvent` populated by the
   pointer layer, **`preventDefault()` supported and functional** (the
   preventable gesture defaults are enumerated at the round's
   docs-first stage), and **no namespace machinery at all**.  Executes
   as **round 41**, resolving item 12 with it.
   ***Landed as round 41 (2026-08-04)** — this item is closed: 41.1 the
   Event (typed `target`, no namespace field), 41.2 the emitter, 41.4
   `originalEvent`, 41.6 the exported types.  Two of the plan's premises
   above were wrong and are corrected in the round record: severing the
   emitter did **not** sever v4's last shared-module import (five utility
   modules remain, now audited), and `preventDefault()`'s gesture half
   could not be enumerated at a docs-first stage because there is no v3
   behaviour to read — that half stays open, in item 12.*
7. ~~**Six benchmark suites are outside the report**~~ (logged 29.6) —
   **closed by round 33.10** (2026-08-03).  `report.mjs` grew a third
   profile: `--all` runs every standalone sweep beside the quick
   v3-vs-v4 tier, and the two manually-timed suites (`curves`,
   `labels`) join the job table through `finishManualRun`, which shapes
   their one-shot rows into the report's format.  No `gpuOnly` marker
   was needed — the renderer already drew groups without a v3/gpu pair
   as individual labelled rows.  The quick profile is deliberately
   unchanged.
8. **Whether error-contract coverage becomes a gate** (logged 30.4) —
   `scripts/throw-coverage.mjs` reports it and deliberately does
   not enforce it, because a floor is a policy call with three parts:
   whether a **new Node-reachable throw with no spec should fail the
   build** (the reading is 0 today, so a zero-tolerance gate would
   hold as of this round); what to do about the **browser-only
   sites** (13 when this call was written, 10 since round 36.4), which
   the Node measurement cannot see at all and which only the `renderer`
   project can pin; and whether the
   `UNREACHABLE`/`MISATTRIBUTED` lists are a maintained allowlist or a
   one-off note.  The JSDoc-coverage precedent (a script plus a test
   that gates it) is right there, so this is a decision about appetite
   rather than about mechanism.
   Note that rounds 31.2 and 32 *did* gate the two documentation
   rules (`@throws`, `@param`) in `test/jsdoc-coverage.mjs`, on the
   reasoning that documentation completeness was already gated here by
   round 26 — so this call is specifically about **test** coverage,
   and the two decisions are meant to be readable side by side.
   **Updated by round 36.4**: the reading is now 176 run, **10
   browser-only, 5 unreachable**, 0 Node-reachable and never run — the
   browser tier is finished (four specs, three reclassifications), so a
   zero-tolerance gate would hold today with less of the tier resting on
   "the Node measurement cannot see it".  The second part of the call is
   correspondingly smaller.  Round 36 also declined to gate its own two
   new audits (`@returns`, stranded doc blocks), keeping the report-only
   family at three and the gated family at three — the same shape this
   call is about.
   **Call taken (2026-08-04): gate throw coverage *and* `@returns`.**
   ***Landed as round 37.1 (2026-08-04)** — this item is closed.*
   Throw coverage becomes a zero-tolerance gate on Node-reachable
   never-run sites, with `UNREACHABLE`/`MISATTRIBUTED` as maintained
   allowlists; `@returns` ratchets at 276/276.  Stranded doc blocks
   and bench coverage stay report-only — each is heuristic in a way
   the gated audits are not.  Executes as **round 37**.

### Contradictions between the code and the decided-design ledger

Each was found by reading the code against this file (rounds 28–29's
docs checks), and each is left in place pending the call.

9. **The legacy-alias triage was applied unevenly** (found 2026-08-03).
   The 2026-07-29 triage dropped the no-dash shape spellings and the
   `autolockNodes`/`autoungrabifyNodes` aliases under "one name per
   concept".  In the code, `roundrectangle` still compiles (while
   `cutrectangle` and `concavehexagon` throw), and
   `cy.autolockNodes()` / `cy.autoungrabifyNodes()` are declared,
   wired and working — round 29.1's alias table now pins them.
   **One call over three names.**  If it goes the ledger's way, the
   two rows in `test/aliases.mjs`, their wiring and `declare`
   lines in `core.mts`, and the `roundrectangle` line in
   `test/decided-drops.mjs` come out together.
   ***Landed as round 37.2 (2026-08-04)** — this item is closed; the
   spelling turned out to be accepted in three enums rather than one,
   and drops from all three.*
   **Call taken (2026-08-04): split.**  `roundrectangle` is
   **dropped** — it throws like `cutrectangle` and `concavehexagon`,
   the triage enforced as written — while `autolockNodes` /
   `autoungrabifyNodes` are **kept** as deliberate, recorded
   exceptions to one-name-per-concept ("possibly useful").  Executes
   as **round 37**; the decided-design ledger's legacy-alias line
   gains the two-name exception in the same pass.
10. **Unknown constructor options are silently ignored** (found
    2026-08-03), including the four canvas-era options the triage
    explicitly dropped: `{ motionBlur: true }` constructs happily and
    round-trips through `cy.options()`, as does
    `{ totallyUnknownOption: 1 }`.  v4 throws on an unknown sheet key,
    an unknown style property and an unknown query key — on the
    stated reasoning that a typo must fail loudly — and the
    constructor is the one entry point that does not.  The call: match
    the rest of the surface (and with what allowance for
    forward-compatible options?), or record the constructor as
    deliberately permissive.
    ***Landed as round 37.3 (2026-08-04)** — this item is closed; the
    options type needed no tightening, and the round found the entry
    point sitting outside every JSDoc audit while writing the test.*
    **Call taken (2026-08-04): the constructor stays
    runtime-permissive by design.**  Excess options are a build-time
    concern — tsc's excess-property checking on the typed options
    object already flags `{ motionBlur: true }` — and v4 does not
    replicate at runtime what the types check at build time.  Round 37
    pins that the type actually rejects it (a compile-only consumer
    test) and records the decision in the ledger and the ctor's JSDoc.
11. **Dropped event names register silently** (found 2026-08-03).
    Round 17 dropped the `vmouse*` aliases and v3's raw mouse/touch
    re-emits, but `cy.on('vmousedown', h)`, `cy.on('mousedown', h)`,
    `cy.on('click', h)` and `cy.on('touchstart', h)` all register
    cleanly and then never fire — a v3 handler that silently does
    nothing.  Event *namespaces* were recorded here as the same story
    — "`cy.on('tap.ns', h)` never fires, not for `tap` and not for
    `tap.ns` either" — and **round 37.4 measured that and found it
    wrong on the second half**.  v4 *then still imported* v3's emitter,
    so namespaces parsed and worked in full v3 semantics: `on('tap.ns')`
    listened for
    `tap` qualified by `.ns`, `emit('tap.ns')` runs both it and any
    plain `tap` listener, `emit('tap.other')` runs only the plain one,
    and `off('tap.ns')` removes it.  The true statement is narrower:
    **v4 never emits a qualified name**, so a namespaced listener sees
    application emits and never a library event.  **Round 41.2 removed
    the machinery** (2026-08-04) by giving v4 its own emitter, which is
    what finally made the design ("no namespaces") and the code agree:
    a type is now matched whole, so `'tap.ns'` is one literal name.
    Note the constraint on any fix: custom event names must stay
    legal (`emit('myevent')` is supported), so the answer is a
    curated denylist of known-v3 spellings that throws or warns, not
    a blanket rule.  29.3 fixed the neighbouring case — a *selector
    string* as an event qualifier now throws instead of detonating
    inside the emitter — but the event *name* side is untouched.
    ***Landed as round 37.4 (2026-08-04)** — this item is closed, and
    the round corrected the namespace half of the evidence above: the
    machinery was live at that point, in full v3 semantics, with only
    v4's own emits unqualified.  **Round 41.2 has since removed it.***
    **Call taken (2026-08-04): event names stay open — no denylist.**
    v3 supports custom events (`node.emit('foo')`) and v4 keeps that,
    so names cannot be gated; dropped v3 spellings register and simply
    never fire, documented as such.  **Closed by round 37.4** (docs +
    specs, no runtime change), which also corrected the namespace half
    of this item: the machinery is live, not merely unexercised — v4
    never *emits* a qualified name, but a hand-emitted one behaves as
    it does in v3.  **Round 41.2 removed the machinery** while leaving
    names free, as planned.
12. **`event.preventDefault()` reaches the DOM but no v4 gesture**
    (logged as "exists and does nothing" from round 27's fact-check,
    and half-fixed since).  It *did* nothing at all: v4 emitted the
    shared v3 `Event`, so the method was present and set
    `isDefaultPrevented` while no v4 code read the flag.  Since round
    41 v4's own Event carries `originalEvent`, so the call now
    suppresses the **browser's** default; what it still cannot do is
    suppress a v4 *gesture* default, which stays gated by options.
    Same family as 10: the call was whether it throws, is removed from
    the v4 event, or stays documented-as-inert.
    **Call taken (2026-08-04): resolved by item 6's v4 Event.**
    `preventDefault()` is kept and becomes **functional** — the
    interaction layer reads `isDefaultPrevented` at the enumerated
    preventable gesture defaults — landing with the v4 Event in
    **round 41**.
    ***Half landed, and the other half needs one more call*** (round
    41.4, 2026-08-04).  The DOM half works: `originalEvent` is
    populated by the interaction layer, so `preventDefault()` now
    reaches the browser's default and `isDefaultPrevented()` reports
    truthfully.  The *gesture* half did not land, because the
    enumeration round 41's plan called for could not be derived the way
    it says.  The plan reads "docs-first enumerates the preventable
    gesture defaults **from v3-source reading**" — and v3 never reads
    `isDefaultPrevented` either (measured 2026-08-04: the only
    references in v3's whole tree are the two that *set* it and its type
    declaration).  So there is no v3 behaviour to port; the list is a v4
    contract to be **designed**, and each entry is a decision about what
    an application may take over.
    The question, concretely: which of v4's gesture defaults does a
    handler's `preventDefault()` suppress?  The candidates the sitting
    named — tap-selection and tap-clear, grab initiation, box start —
    plus the ones it did not: pan and wheel-zoom (already gated by
    options), taphold, and whether prevention on a *bubbled* element
    event stops the core's default too.  Each needs a spec proving both
    directions, which is cheap once the list exists.
    Logged rather than guessed at because a wrong list is worse than
    none: an app that learns `preventDefault()` suppresses selection
    will depend on it.
    **Direction set (2026-08-06, sixth sitting); the enumeration holds
    for 41.5's docs-first.**  The maintainer's rule: gestures get
    **explicit toggles first** — the `panningEnabled()` pattern exists
    precisely to make gesture control easy and explicit — and no
    gesture default may be controllable *only* through
    `preventDefault()`.  Supporting both is on the table, with the
    toggle primary and `preventDefault()` a per-event complement.  So
    41.5's docs-first must map each candidate default to its explicit
    toggle (existing — `autoungrabify`, `autounselectify`,
    `boxSelectionEnabled`, `userPanningEnabled`/`userZoomingEnabled` —
    or to be added) before proposing any preventDefault rows.  A
    four-row table was tabled at the sitting for that stage to react
    to: `tapstart` on an element → grab initiation; `tap` on an
    element → the selection toggle; `tap` on the core → the background
    clear; `boxend` → applying the box's selection — with pan/wheel
    (option-gated, high-frequency), taphold (no default) and the cxt
    menu (already unconditional) excluded, and bubbled prevention
    stopping the core default via 14.5's shared-Event machinery.
    **The docs-first proposal is written (2026-08-08)** — the section
    "Round 41.5 docs-first" in `plan/rounds/`: the toggle map is
    complete (three of four rows have existing toggles at both grains;
    the background clear is coarse-only, with no new option
    recommended), rows 1–3 are implementable as emitted today, and row
    4 (`tapstart` → grab) is **not** — the press handler grabs before
    it emits — so the proposal recommends dropping that row and logging
    the emit reorder as its own later call.  Awaiting the maintainer's
    reaction; the round does not start before it.
    ***Closed (2026-08-09, seventh sitting): toggles only — no rows at
    all.***  The maintainer went further than the proposal's
    recommendation: not just row 4 but the whole table is declined.
    `preventDefault()` is **browser-level only** as the permanent
    contract — it suppresses the DOM default through `originalEvent`
    and nothing else — and gesture defaults are controlled exclusively
    by their explicit toggles (`autoungrabify`, `autounselectify`,
    `boxSelectionEnabled`, `userPanningEnabled`/`userZoomingEnabled`,
    and the per-element grains).  Round 41.5 does not run; no emit
    reorder is logged, since nothing now wants it.  The
    `Event.preventDefault` doc comment's description of the gesture
    half becomes decided design rather than a gap.
13. ~~**The `Gpu*` exported type names**~~ — **closed by round 42.6**
    (2026-08-04).  Round 42 renamed the package's *identity* — factory,
    bundles, declaration, UMD global — but stopped at the exported **type**
    names, which still read `GpuCore`, `GpuCollection`, `GpuEvent`,
    `GpuStylesheet`, `CytoscapeGpuOptions` and 37 others.  The `Gpu` there
    meant "the prototype, as opposed to v3" at a time when both lived in one
    package; once v4 *was* the package it meant nothing, and a consumer was
    writing `const cy: GpuCore = cytoscape( opts )`.  Logged rather than
    swept because it is public surface.
    **Call taken (2026-08-04): remove the prefixes, no deprecated aliases.**
    The prerelease line has no published consumers to break — `./gpu` is
    aliased because *v3's* users type it, which is a different situation —
    so carrying both spellings would only preserve a name nobody has yet
    written.  `Core`, `Collection`, `Event`, `Stylesheet`,
    `CytoscapeOptions`, and so on through all 42 exports.
    **Six names keep the prefix, deliberately**: `GpuContext`, `GpuTimer`,
    `GpuForceRuntime`, `GpuTweenRuntime`, `GpuTweenSink` and `GpuWriteKind`
    — every one of them internal, and every one naming the *device* half
    against a CPU counterpart, which is the same rule that kept the
    `gpu-*.mts` file names in round 42.1.

    None is exported.

23. **`arrow-scale` is quantized to 1/16, and it is not only readback**
    (round 56, 2026-08-07).  `edge.arrowShapes` stores the scale as an
    integer x16 in its top byte (round 13 B7).  The ledger has described
    that as "quantized readback — recorded" since; measurement says the
    scope is wider.  The *drawn* head takes its size from the quantized
    value, and since round 56 so do v3's `gap` and `spacing`, so an
    `arrow-scale` that is not a multiple of 1/16 is wrong in geometry as
    well as in what `style()` reports.

    Measured at `arrow-scale: 1.4`,
    which quantizes to 22/16 = **1.375**: the triangle gap is 19.25
    against v3's 19.6, the circle spacing 12.260282 against 12.483196,
    and the straight midpoint 120.187500 against 120.100000.  1.8% small
    on every arrow quantity.
    Deliberately **not** dodged by giving the routing scenes a
    representable scale: the seven residual fields are pinned in
    `routing-ledger.mjs` with two-sided bands, so re-quantizing the field
    fails them and forces a re-measurement.
    The call, and why it is one: the contract's own note says the escape
    hatch is that "the scale byte can be re-quantized", and there are six
    reserved bits (18..23) sitting next to it.

    Spending them takes the
    scale to 14 bits at x128 — 0.11% error instead of 1.8% — but
    **forecloses a 17th arrow shape**, which the same paragraph names as
    the other claim on that span.  Which of the two the reserve is for is
    the maintainer's call, not a round's.
    (Note the third option: leave it.  v3's own `arrow-scale` is a
    presentation knob and 1.8% of an arrowhead is sub-pixel at most zoom
    levels — the reason this was invisible until a close-up scene
    existed.)

    **Deferred by the maintainer (2026-08-07): logged, not decided.**  No
    round may spend the reserved span until this is answered — which is
    why round 56's own need for two flag bits was met from `edge.width`'s
    mirror lane instead, leaving all six bits of the real column intact.

24. **Where the arrow trim cannot reach** (round 56, 2026-08-07) — two
    places the gap is not applied, both because a vertex stage is at the
    8-storage-buffer budget with no slot for `edge.width`, and a layout
    entry counts even for a binding the shader never reads:
    - **edge labels** anchor at the untrimmed midpoint, ~2.6 model px
      from what `midpoint()` answers on an arrowed bezier;
    - **overlay / underlay / casing strokes** run a gap further than v3's,
      which strokes its casing along the shortened path.
    Neither is a decision — the fix is to free a binding, and the
    curved-edge pipeline's own layout split is the precedent.  Logged
    rather than attempted inside a round that had already grown large.
    **Scheduled as round 58 (2026-08-09, seventh sitting)**, after the
    maintainer asked what it would cost: the trim math already runs per
    vertex on every curved-edge strip, both new populations (edge-label
    glyphs, layer-stroke quads) are small fractions of the vertex work
    in a renderer bound on instance/fragment count, and both precedents
    for freeing the binding (the layout split, the pre-derived
    `edgeLayer` stroke width) added no measured frame cost.  The plan
    is in `plan/rounds/`.
    ***Landed as round 58 the same day — this item is closed.***  The
    freed binding is the fused `node.outerGeom` column; the fix reached
    a third consumer the entry had not named (the straight mid-arrow
    anchor, which was the centre chord where `midpoint()` answers v3's
    four-point mean); both new close-up parity scenes read **0.000%**
    against v3 with controls failing at 7.7x and 27.9x their bounds.
    See the round-58 record.

27. **v4's edge underlay/overlay band is `width + 2 × padding` wide;
    v3's is `2 × padding`** (round 58, 2026-08-09).  Found by a parity
    scene draft: underlay + small heads on a short edge read 7.105%
    mismatch, and the diff was band-width along the whole span, not the
    trim the scene was named for.  Measured against
    `v3/src/extensions/renderer/canvas/drawing-edges.mts` —
    `drawEdgeOverlayUnderlay` sets `context.lineWidth = 2 * padding`,
    nothing else — so at v3's defaults a padding smaller than half the
    line width draws a halo *narrower than the line*, i.e. invisible.
    v4's round-13 A2 formula (the edge geometry stroked at
    `width + 2 × padding`, recorded in `src/README.md`) matches the
    *node* overlay's semantics (the node's own extent plus padding) and
    always shows the halo.  The casing (`line-outline`) is unaffected —
    both libraries agree on `width + outlineWidth`.
    The call: keep v4's formula as a deliberate deviation (arguably the
    saner semantics, but a visible difference in any app that styles
    edge overlays), or match v3's.  Logged rather than patched: either
    direction changes rendered output, and the `edge-layers` golden and
    the round-13 A2 zoom-1 parity scene (which passes today because its
    padding values happen to dominate the width term) both move if the
    formula does.  Related recorded deviations, unchanged by this: v3
    rounds these strokes' caps where v4 butt-cuts, and v3's erase-only
    compositing where heads overlap.

28. **`cy.collection( anything )` silently ignores its argument** (round
    60.2, 2026-08-09).  v4's `collection()` is the zero-argument empty
    accumulator; v3's `collection( eles?, opts? )` also builds from a
    string, an element array or a collection.  So the v3-shaped call
    `cy.collection( arrayOfEles )` type-errors at build time but at
    runtime returns the **empty collection**, silently — which is how a
    round-60.2 benchmark band came to select nothing in 53 ns.  v4
    throws on an unknown query key, an unknown sheet key and an unknown
    `boundingBox()` option on the stated reasoning that a typo must not
    silently do nothing; this is the same shape at a method boundary.
    The call: throw on any argument (fail loudly, plus a
    migration-guide row), port the array-building form, or record the
    permissiveness as deliberate.  Logged rather than patched — it is
    public surface either way.
    ***Closed (2026-08-10, ninth sitting): throw on any argument —
    landed as round 64 the same day***, together with two aliases taken
    at the same sitting: `cy.$` returns as a plain alias of `filter()`
    over the v4 query API (in line with `cy.$id()`; selector strings
    still throw through filter's own rejection), and `cy.byId` joins
    `$id`/`getElementById` for brevity.  See the round-64 record.

### Public-surface changes made without a call, logged rather than buried

None of these needed a decision to *make* — one is a missing export and
the other two are wrong answers — so none was held.  All three are
visible to a consumer, which is why they are here and not only in a round
record: the standing rule is that the maintainer reads this section
before deciding anything about v4's surface, and "we changed it because
it was obviously broken" is exactly the sentence that should be
reviewable.

**All three were reviewed individually and ratified at the sixth
sitting (2026-08-06)** — the type exports stay, the cross-instance
throw stays, the tighter compound fit stays — so this section's review
debt is cleared.  Item 16's logged follow-up is no longer merely
logged: the **bounds round is scheduled as round 54**, before round 49
(the plan stub is in `plan/rounds/`).  *Round 54 landed
2026-08-08 — fit zoom 0.607 → 0.822 on the compound fixture, and its
sweep caught a taxi soundness hole on its first run; see the record.*

14. **The layout contract's types now ship** (round 45, 2026-08-04).
    Round 17 made `cy.layout({ impl })` the whole extension story — an
    import passed straight in, no registry — and round 34.6 noticed in
    passing that `LayoutContext` "is not in the shipped declarations at
    all; it appears only inside a doc comment", but nobody drew the
    consequence: `CustomLayoutOptions` shipped while the two types an
    external author actually writes against did not, so `run( ctx )`
    typed its parameter `any` in the one surface the contract exists to
    make obvious.

    `LayoutContext`, `LayoutImpl` and `CustomLayout` are
    now exported from the entry point, on the precedent of round 41.6
    exporting the event types for the identical reason.  The type-surface
    audit caught it as an unexpected export, which is that audit working;
    42 → 45 type exports.  **To reverse**: drop the re-export line in
    `src/index.mts` and the three names from `EXPECTED_EXPORTS`.
15. **Comparing elements across two instances now throws** (round 48.4,
    2026-08-04).  A ref is `{ group, slot, gen }` and identity packs
    those three, all of which are per instance — so the first node of one
    graph and the first node of another packed identically, and all
    twelve methods round 29.3 guarded answered accordingly: `same()`
    **true**, `contains()` true, `indexOf()` 0, `intersection()`
    everything, `difference()` nothing, and `union()` silently dropping
    the other graph's elements (two graphs of two nodes united to two,
    reading back the first graph's data twice).

    They now reject a
    collection from another instance, through the same
    `assertCollection` guard round 29.3 added to those exact twelve for
    the same stated reason.
    Recorded because it *is* a behaviour change a consumer can see, and
    because v3 is inconsistent here rather than right — measured: v3's
    `same()` answers false, but its `union()` of 2 + 2 gives 2 and its
    `difference()` gives 0 — so "match v3" is not available as an answer.
    The alternative to throwing would be a cross-instance identity, which
    v4 cannot represent: a `_refs` slot is meaningless outside its store.
    **To reverse**: drop the `cy` argument from `assertCollection`.
16. **A no-argument `cy.fit()` frames compound graphs tighter** (round 43.13,
    2026-08-05).

    The conservative whole-graph scan added the *chord length* to
    every box-bounded edge except taxi — a term that describes a
    weight-extrapolated blob route, inherited by `CURVE_CMPD` when round 14.10
    put compound loops behind the same flag.  On `debug/`'s compound fixture the
    scan read 1718 × 1572 against an exact 802 × 637, so `fit()` drew the graph
    at a third of its size; removing the three compound-loop edges made the two
    boxes identical, which is what localized it.
    Recorded because it *is* visible: any app whose graph has a
    parent↔descendant edge or a parent self-loop now gets a different zoom and
    pan from `cy.fit()`/`cy.center()` than it did.  The direction is the safe
    one — the box only shrinks, and it still contains the exact box (pinned by a
    spec, and by a 512-edge sweep over 60 randomly-shaped compound graphs run
    before the change) — so this is a wrong answer corrected rather than a
    policy chosen.  The `render/cull.mts` twin keeps its chord deliberately:
    over-inclusion in a cull costs efficiency, never correctness.
    **To reverse**: drop `&& kind !== CURVE_CMPD` from the two
    `FLAG_CURVED_BOX` branches (`GraphStore.boundingBox`,
    `Collection.boundingBoxAt`).

**Two more joined at round 62** (2026-08-09, the every-benchmark-beats-v3
round), both cache-shaped and both mirroring the ratified round-34.2
`elements()` memo:

17b. **Whole-object `data()` returns the same object until something
    invalidates it** (62.4).  Rebuilding the object from the columns per
    call could not beat v3's return-the-stored-pointer, so the built
    object caches on the handle against the DataStore's write epoch plus
    the synthesized fields' inputs (parent slot / endpoints) and the
    ref's generation.  Two calls with no write between them return the
    *same object*; a caller mutating the snapshot sees its own mutation
    until the next data write.  v3 goes further — it hands out its live
    internal object, where mutation corrupts the actual store — so v4's
    exposure is strictly narrower.  Pinned by four specs in
    `test/data.mjs` (identity, write/reparent/re-point invalidation, no
    cross-element leak).  **To reverse**: delete the `_dataObj` check
    and always build.
17c. **Animation handles carry prototype methods** (62.4).  The nine
    per-handle arrow closures became `AnimationHandleImpl` methods — a
    handle was ~2.9 µs to build through tsx against v3's ~0.5 for
    methods that never differ.  The narrowing: a destructured method
    must be re-bound by the caller, exactly as v3's own animation
    object behaves.  **To reverse**: inline the closure object back
    into `animation()`.

### New open calls (sixth sitting, 2026-08-06)

Two questions that had been living only in round records — against the
standing rule that every open question surfaces here — plus the
conditional halves of calls the sitting took.

17. **miniray as a devDependency** (round 52's call 2, conditional).
    The sitting took call 1 — the 52.1 comment-strip build step
    **builds**, before round 50 cuts the alpha — and left this one on
    the plan's own terms: 52.3 (generate static WGSL from
    `contract.mts` + identifier renaming via miniray, 4.35 MiB of
    Go-compiled WASM for an estimated single-digit-KiB gzipped gain)
    is reached **only if 52.1's measured number disappoints**, and the
    estimate must be measured on one shader before any machinery is
    built.  Expected outcome: never taken.
    ***Resolved by measurement (2026-08-08, round 52 landed): the
    condition is false.***  52.1 took 19.0 KiB gzipped, above its own
    17.8 estimate, so the trigger never fired; miniray is not added.
    The entry stays as the record of the reserve plan, closed unless a
    future round reopens bundle size.
18. **Warm the tween pipelines at init?** (round 53.1's left-open
    judgement.)  A user's *first* `animate()` on a software adapter
    stalls up to ~1.8 s because Dawn compiles the tween compute
    pipelines on first use; warming them at init moves that cost into
    startup, which round 53 just spent effort reducing, and real
    hardware shows the same shape an order of magnitude smaller.
    **Call taken (2026-08-06): logged, revisit with data** — the case
    for warming rests on software-adapter users, so measure who those
    are before paying startup for them.

    The maintainer also noted a
    larger future direction to keep beside it: **a WebGL fallback
    renderer** may be worth considering for users whose platforms
    cannot support WebGPU at all — logged as a direction, not scoped.
19. **v3's derived parent box is 1 px larger per side than v4's** (round
    55, 2026-08-06).  Measured on a parent with two 30x30 ellipse
    children and padding 10: v4's box is the children's union plus
    padding *exactly* (120.00 wide), v3's is that plus 1 px on each side
    (122.00), and **the gap does not move with `border-width`** — 0, the
    default, and 4 all give 1.0 px per side.  So this is not the
    border/miter difference `src/README.md` records, and that note is
    incomplete as an explanation of parent-box differences.

    Everything
    on an ancestry edge follows from it (v3 builds compound control
    points from `min(pos − outerW/2)`), and it is what the round-55
    routing harness reports as a flat 1.000000 on every field of
    `p-child`, `p-grandchild` and `child-p`.
    **Call taken (2026-08-06): keep v4's tighter box; the deviation is
    recorded, and so is the reason v3 has the pixel.**  The maintainer
    supplied what the measurement could not: v3's extra pixel exists
    because v3 caches *elements as textures* and composites them through
    canvas2d, where antialiasing makes the true extent uncertain by
    about a pixel — the margin is a rendering allowance, not geometry.

    v4 has no per-element textures and rasterizes the whole scene on the
    GPU, so it has nothing to allow for.  That also resolves why the gap
    was invariant to `border-width`: it was never a border term.
    This settles the question `src/README.md` had been describing
    incompletely, and it agrees with the direction already set — round
    54 tightens compound bounds further, and item 16 ratified the
    tighter compound `fit()`.
    Not yet isolated, and deliberately not claimed: the larger
    divergences in the same scene (`parent-parent` 16.04 px,
    `leaf-parent` 8.07 px) are *consistent with* the same 1 px amplified
    where an endpoint clips a box at a shallow angle, but that has not
    been demonstrated.
20. **`sourceEndpoint()`/`targetEndpoint()` answer the node centre on a
    straight edge** (round 55, 2026-08-06).  v3 answers the node
    *boundary* (its `rs.arrowStartX/Y`, the spacing-shortened arrow
    point).

    v4's `Collection._endpointPoint` falls through to the raw
    node positions whenever there is no curve eval and no route, which
    is every straight edge — so the answer is off by a whole node
    radius, measured as 13.207 px on a 30x30 node at the harness's
    generic slope, and by exactly the boundary offset in every straight
    row of every scene.  `renderedTargetEndpoint()` is how applications
    place custom overlays, so this is visible, not theoretical.
    **Call taken (2026-08-06): match v3.  Landed the same day.**
    `GraphStore.straightEndpointAt` resolves the boundary along the
    chord — the CPU twin of the straight arrow shader's own tip
    placement, so the accessor reports the point the renderer draws to.
    The one v3 term deliberately left out is the arrow shape's
    `spacing`, non-zero only for `tee` and the circle heads: it arrives
    with the gap/trim port, so the accessor never describes a point the
    renderer does not draw.
    Effect on the routing harness's `arrows` scene: **14 diverged fields
    to 4**, and the residual is exactly that spacing term — `circle` by
    9.880383 (`getArrowWidth(5, 1.5) x 0.15`) and `tee` by its constant
    1.0, with the other five heads clean.  The `base`, `families` and
    `bundles` scenes went fully green and lost their `test.fail()`
    markers.
    One prediction in that plan was wrong and is corrected here: the
    Playwright probe at `renderer.spec.js:4516-4546` was expected to
    break and did not, because it exercises a *manual endpoint* (12c),
    which takes the route path rather than the straight fall-through
    this changed.  Only `test/collection-dimensions.mjs` needed
    rewriting.

21. **Hollow and translucent *mid* arrows keep showing the line**
    (round 55, 2026-08-06; **still open after round 56**, which landed
    the endpoint trim and left mid arrows exactly as this entry
    describes).  The fix for endpoint heads is to stop the
    line short of the head, which reproduces v3's `destination-out`
    erase at zero runtime cost.  A mid arrow sits mid-line, where a trim
    cannot reach, so it is not covered.
    **Call taken (2026-08-06): punt and log.**  Record it as a
    deviation, and note the maintainer's lean — **v4 may simply not
    support `arrow-fill: hollow` on mid arrows**, in which case the
    deviation becomes a documented drop rather than a defect.

    Revisit
    with a scene that measures how visible it is; the round's own
    cautionary case is that the filled-head gap *looked* dramatic and
    measured 0.495%.  The options priced, if it is ever taken up:
    collapse the strip quads inside the mid arrow's arc-length window
    (no extra draw, but the edge vertex shader then needs the mid shape
    ids, which pushes toward the heavier trim carrier), or build the
    erase pass for that case alone.
22. **`edgeHitsBox` keeps its straight-edge approximation** (round 55,
    2026-08-06).  Round 56 shortened the drawn line, so the comment
    claiming containment and box selection "agree about where the edge
    is" is now inexact, as this entry predicted.
    **Call taken (2026-08-06): keep the approximation, amend the
    comment.**  It backs box selection, where a stub of an edge near a
    node is not a distinction a user is making, so the cheap and simple
    answer is the right one on UX grounds.  The comment is the thing to
    fix, not the code — this entry exists so that a later reader finds
    a decision rather than an inconsistency.

### Logged round ideas (raised, not scoped)

Directions the maintainer has raised that are neither open questions nor
scheduled work.  They live here rather than in a round record for the
standing reason the ledger exists — an idea recorded only where it was
raised is an idea nobody finds — and each carries the first thing that
would have to be measured, so picking one up starts from a question
rather than from a blank page.

25. **Bring the bypass UX back, spelled as a `case` mapper** (raised
    2026-08-07).  v4 removed the per-element style bypass by decided
    design: `ele.style( name, value )` throws (29.3), and round 31.1
    corrected its message to name the declarative replacement.  The idea
    is to give the *ergonomics* back without giving the mechanism back —
    a bypass call rewrites the sheet so that element gets the value
    through a `case` clause keyed on its id, which keeps every value
    analyzable, serializable and GPU-evaluable (round 8's invariant, and
    the whole reason the fn form went).
    Three things to measure before building any of it, in this order:
    - **What the clause chain costs.**  `case` is CPU-evaluated and
      first-match-wins over an ordered list, so N bypassed elements is an
      N-clause chain evaluated per element of the group — quadratic in
      the thing an app does most (`benchmark/style.mjs` is the suite).  A
      per-id index over the clauses is the obvious answer and is a change
      to the mapper IR, not to the sugar.
    - **What `style()` reads back afterwards.**  Stored truth is v4's
      readback rule, so a bypass would read back like any other resolved
      value — but `cy.style()` and `cy.json()` would now export a sheet
      the app never wrote.  That is a real surface change and probably
      the deciding question.
    - **What removes one.**  v3 has `removeStyle`; here it is "drop the
      clause", which needs the clause to be identifiable, which is why
      the keying is a design call rather than an implementation detail.

    **Direction set (2026-08-10, eighth design sitting): the ergonomics
    return, but not in this shape.**  The three measures were taken
    through the built bundle, and two of them killed the case-rewrite
    spelling outright: one id clause in an otherwise state-conditioned
    sheet nulls the 57.1d partition for its whole group and re-opens
    the round-60.4 select regression (256-band select+unselect
    **53.7 → 392.0 µs**, measured), and the chain cost is the
    predicted O(k·V) (k = 1000 clauses: 6.2× on applyAll).  A third
    wall this entry had not seen: a `case` clause's `then`/`else`
    parse to scalars, so a scale-mapped channel — em-web's
    `background-color`, the flagship sheet — cannot take the wrapper
    at all without a mapper-IR change.  The direction is a first-class
    **`overrides` sheet section** instead (id-keyed constants applied
    as an overlay at the write funnel), with the v3 method spellings
    returning as sugar over it, v3's bypass-beats-everything
    precedence, export as a named section, and **performance as the
    maintainer's stated top requirement**.  The full proposal is
    the round-63 plan in `plan/rounds/`.
    ***Approved with two amendments the same day (2026-08-10), and
    scheduled as round 63***: the sheet section's key is **`bypasses`**
    (not `overrides`), and style property keys accept **both dash-case
    and camelCase everywhere in the API** — in the bypasses and in
    every other place a prop name is taken.
    ***Landed as round 63 the same day — this item is closed.***  The
    29.3 setter throw is reversed, the section exports, and the
    performance contract held under measurement (the set path 2×
    faster than v3 through the built bundles; bypass-free selects
    unchanged).  See the round-63 plan and records.
26. **Split the big implementation files, v4's way** (raised
    2026-08-07).  `style.mts` is 7.9k lines, `collection.mts` 5.8k,
    `store/graph-store.mts` 5.0k, `render/shaders.mts` 4.3k, `core.mts`
    3.1k.  v3 split its collection into `v3/src/collection/*` (traversing,
    data, dimensions, events, …); v4 has already done the same thing once,
    for `src/algorithms/` — one file per algorithm over a shared
    `algo-shared.mts`, slot-native, no prototype patching.
    The constraints are what make this a round rather than a refactor
    anyone can do in an afternoon, and all three are things this file has
    already been bitten by:
    - **The audits read files as text.**  `PUBLIC_API` is a file list, and
      `auditFile` walks *class bodies*; a split done v3's way — assigning
      onto a prototype from several modules — would make every moved
      member invisible to coverage, `@param`, `@returns` and `@throws` at
      once, and the gates would keep reading 100%.  That is round 57.2's
      lesson before the fact.  Whatever shape is chosen has to keep the
      members inside the class, or the audits have to learn the new shape
      first.
    - **The `// -- section --` banners are the docs generator's section
      grouping** (rounds 26 and 45).  A split has to decide whether a file
      boundary *is* a section boundary; if it is, the generator gets
      simpler, and `docs-generate` has a spec that will say so.
    - **`git blame` and this file's own round records point into these
      files.**  A move is cheap to make and expensive to have made
      carelessly; round 42's method (compare every moved file against its
      pre-move blob, and filter the diff to the changes the round is
      *allowed* to make) is the one that proved a 1100-file move
      behaviour-neutral, and it applies here unchanged.

29. **A worker-pool executor for the per-source-parallel algorithms**
    (raised 2026-08-10, round 65.10 — the maintainer asked what the
    GPU-modest algorithms could gain from wasm/SIMD/threads, and this
    is the piece that survived the analysis).  Weighted
    `betweennessCentrality` is contracted CPU-only (Brandes over
    weights needs a priority queue) and is n independent Dijkstras —
    embarrassingly parallel across sources.  A pool of plain workers
    (Node `worker_threads` / browser `Worker`) with *transferable*
    typed arrays needs no SharedArrayBuffer and therefore no
    COOP/COEP isolation — our algorithms are snapshot-in/result-out —
    and it can keep the CPU executor's **bit-reproducibility**:
    partition sources into contiguous ranges and combine per-node
    sums in range order, and the f64 summation order matches the
    sequential reference exactly, a property no GPU executor offers.
    It slots behind the round-65 `executor` contract ('auto' picking
    workers where no adapter exists), with the pool cached like the
    GPU device.  Deliberately *not* wasm: SIMD reorders float sums
    (a third numerics tier), wasm threads inherit the SAB isolation
    constraint plain workers avoid, and a new toolchain fights code
    standard 7.  **First measurement before building**: weighted
    betweenness at n=2048 through a 4- and 8-worker pool against the
    sequential reference on the same box — proceed only if the
    speedup clears ~3× at 8 workers after pool-startup amortization,
    and re-check the per-worker copy cost of the CSR against
    SharedArrayBuffer before concluding SAB is unnecessary.

*Items 30–50 entered 2026-08-19 — a brainstorm sitting swept against
the scheduled rounds 71–97, so nothing below duplicates a scheduled
round.  Four asks raised the same day were already covered and are
pointed at rather than re-logged: annotations are round 81, the
table/filter affordances are round 84, the WebGL2 fallback is round
73 (whose plan now carries the sequencing note raised today), and
the create-react-app-style extension scaffold is round 71's
`cyext init`.  Two of the sitting's other candidates already live in
this file and stay where they are: the file split is item 26, and
per-component discrete layouts / layout-lifecycle unification / the
bulk discrete-animate tween are round 87's "suggested further
directions".*

30. **Golden coverage, enumerated — what no golden sees** (raised
    2026-08-19).  The visual suite is ~45 goldens plus the parity
    scenes, and this repo's most repeated visual-testing lesson is
    that a golden only measures what is not painted over.  Nothing
    enumerates the inverse: which style properties have *no pixels
    riding on them at all*.  The round builds the enumerator the
    audits already model (`bench-coverage.mjs`'s shape): instrument
    the style engine while the golden scenes render and record which
    (property, non-default value) pairs are exercised, then diff
    against the full compiled-property list.  Second tier, for the
    exercised-but-occluded class: a scripted degrade control — reset
    one property to its default, re-render, count pixels moved —
    run over a chosen subset, since a property that moves zero
    pixels when deleted is decoration in that scene.
    **First measurement**: the count of style properties for which
    no golden scene sets a non-default value.  Expect the number to
    be embarrassing; rounds 27/55/56 each found scenes measuring
    nothing, one property at a time.
31. **Scripted gesture traces — the interactions get parity
    scenes** (raised 2026-08-19).  Goldens cover static frames;
    gestures are verified by Node specs plus a person driving
    `debug/`.  The round adds a Playwright tier that replays
    recorded pointer traces — drag, box select, wheel zoom, pinch,
    cxt press, grab-and-throw — against both renderers on
    `parity.html` and diffs *end states numerically*
    (`routing.spec.js`'s method, not pixels): positions, the
    selection set, pan/zoom.  Round 89.3 already builds real-browser
    gesture driving for cursors; this generalizes its machinery.
    The known traps are already written down: mid-flight assertions
    poll (never sleep-to-offset), and the frame driver is
    load-bearing under SwiftShader.
    **First measurement**: the inventory — which gestures have any
    browser-level assertion today, and which have only headless
    synthetic-event coverage.
32. **The benchmark coverage audit graduates** (raised 2026-08-19).
    `bench-coverage.mjs` stays report-only *deliberately* — it is
    heuristic where the gated three are not — so graduation is not
    "flip it to gate": it is round 30's triage applied to benches.
    Every public member ends in one of three states: a row that
    discriminates, a keyed exemption with a reason (audited, so a
    stale entry fails — the throw gate's rule), or a recorded
    not-perf-relevant call.  Only after the triage does the audit
    gate at zero, and only if the heuristic's false positives were
    fixed rather than exempted around.
    **First measurement**: the current uncovered count and its
    composition — how much is one-line trivia versus real hot
    surface — which decides whether this is a round or an
    afternoon.
33. **Mutation testing as the automated control** (raised
    2026-08-19).  The repo's most productive habit is the hand-made
    control: break the behaviour deliberately, watch the spec fail.
    The round automates the cheap subset — swap comparison
    operators, negate guards, delete `throw` branches — over one
    subsystem at a time, runs the narrowest suite that claims to
    cover it, and reports mutants no spec killed.  Constraint that
    makes it a round: runtime.  Whole-tree mutation over `npm test`
    is days; per-file scoping with narrowed test selection is the
    design problem, and the tool must respect the `.mts`-via-`.mjs`
    import convention.
    **First measurement**: mutation-survival rate on `src/style.mts`
    (the largest file, 7.9k lines) under `test:js` alone — the
    survivor list *is* the finding, whatever the tooling verdict.
34. **A renderer soak tier** (raised 2026-08-19).  `test:soak`
    churns the model; nothing churns the GPU side for hours.  The
    round adds a browser soak: repeated add/remove/restyle/zoom
    cycles on a real adapter, tracking the renderer's *own*
    allocation ledger (buffer bytes, atlas pages, realloc counts —
    Dawn exposes no VRAM meter, so the instrumentation is ours),
    plus repeated device-loss/recovery cycles where 48.5 does one.
    Growth that trends is the failure, exactly as in the Node tier
    — and the first spec must be the probe's own control (a
    deliberately-leaked buffer must show), or every spec after it
    passes by doing nothing.
    **First measurement**: tracked allocation totals over 10k
    add/remove/restyle cycles at fixed graph size — flat or not.
35. **The scale ceiling** (raised 2026-08-19).  The largest thing
    v4 has ever rendered is the 465k-edge `ndex-x-large`.  Nothing
    records where it actually breaks — 1M? 5M? — or *which*
    subsystem fails first: ingest, style apply, the curve blob, the
    atlas, cull, pick, or a device limit at buffer creation.  The
    round builds a synthetic-growth harness (the `debug/`
    generators are the seed) that bisects to first failure per
    subsystem, documents the ceiling in `src/README.md` as a
    measured number rather than a hope, and raises the cheapest
    limiter.  Companion to item 36; likely the same harness.
    **First measurement**: the bisect at 1M/2M/5M edges on the
    RX 580 — failure mode and owning subsystem for each.
36. **The VRAM budget, and failing gracefully** (raised
    2026-08-19).  Device *loss* is tested; allocation *failure* is
    not — nothing defines what a `createBuffer` failure mid-session
    does today (probably an unhandled error or a lost device,
    neither chosen).  The round prices bytes-per-node/edge/label
    across the pipelines (measured, not derived from the contract),
    publishes the figure, and designs the degradation order —
    plausibly labels first, then charts/images, then curve
    subdivision — so an out-of-memory frame degrades instead of
    dying.  v4 fails loudly by design; this is the one place
    "loudly" should mean "visibly worse", not "gone".
    **First measurement**: force an allocation failure on a real
    adapter and record what actually happens now; then the
    per-element byte price at three graph sizes.
37. **Accessibility** (raised 2026-08-19).  A canvas renderer is
    invisible to assistive tech, and no scheduled round touches it.
    Scope, in priority order: keyboard navigation (a focus model —
    tab into the graph, arrows traverse neighbours, keys pan/zoom);
    a generated DOM/ARIA mirror describing the focused element and
    its neighbourhood (scoped — mirroring 465k elements is not a
    plan); a renderer-drawn focus indicator (the pick-ring look is
    the obvious carrier); and `prefers-reduced-motion` honoured by
    the tween layer (collapse animated transitions to their end
    states).  The ecosystem apps have had to solve none of this
    *because the library never gave them a substrate* — which is
    the tenth sitting's demand-signal argument in reverse.
    **First measurement**: a screen-reader transcript over
    `debug/index.html` (predictably: silence), and an inventory of
    what Cytoscape Web built or skipped for a11y.
38. **Label internationalization — CJK first** (raised 2026-08-19;
    **the maintainer's priority order: CJK is highest after
    Latin**).  The label pipeline shapes Latin-simple text: no CJK
    line-breaking, no bidi/RTL, unknown emoji behaviour, and a
    glyph atlas sized for alphabets rather than for the thousands
    of distinct glyphs a CJK graph carries.  The CJK tier is
    tractable precisely because CJK needs no shaping: the work is
    (a) atlas capacity — growth and eviction policy under
    thousand-glyph label sets; (b) line-breaking without spaces —
    break-anywhere plus the kinsoku prohibition classes; (c) a font
    fallback chain, since the vendored Open Sans has no CJK and
    today's fallback behaviour is whatever canvas-2D rasterizes.
    RTL/bidi is a separate later tier — it *does* need shaping,
    which means a real dependency decision against code standard 7
    — and emoji/color fonts later still.
    **First measurement**: render a CJK-labelled fixture beside v3
    in the harness and catalogue what is wrong; count atlas pages
    consumed by ~500 distinct CJK glyphs.
39. **Lasso selection + public spatial queries** (raised
    2026-08-19).  v3.30 added lasso; v4 has box selection only (no
    `lasso` anywhere in `src/`).  The columns are CPU-canonical and
    the cull/pick tier already answers box and point questions, so
    a polygon-containment query is an extension of what exists, not
    a new index.  Pair it with the API it implies: public spatial
    queries — nearest node, k-nearest, elements-in-polygon —
    beside round 75.4's public sync pick, since every app that
    wants lasso wants those next.
    **First measurement**: what `cull.mts`/`cpu-pick.mts` already
    provide toward polygon containment, and the cost of
    point-in-polygon over 100k nodes at a realistic vertex count.
40. **Compound drag-and-drop reparenting** (raised 2026-08-19).
    The `compound-drag-and-drop` extension is a standing ecosystem
    bolt-on, and v4 owns everything it needs: the hierarchy lives
    in `store/hierarchy.mts`, `move({ parent })` exists, and the
    drag gesture is ours.  Scope question to settle first —
    primitives or gesture: drop-target resolution during drag +
    a preview affordance (primitives an extension composes), versus
    the full gesture in core.  The v3 extension is the requirements
    document: enumerate what it reimplements versus what it would
    call.
    **First measurement**: that enumeration, plus what drop-target
    resolve costs per pointermove at depth (it is a point query
    against parent boxes the hierarchy already maintains).
41. **Undo, on the columnar store** (raised 2026-08-19).  Every
    editor app builds an undo stack over this library; `cy.batch()`
    exists but no history does.  The columnar store is uniquely
    placed: a snapshot is typed-array copies (the wire format
    already serializes columns), so the design fork is snapshots
    (simple, memory-priced) versus an inverse-operation log
    (cheap per-op, but every mutating API — data, bypasses,
    hierarchy moves, element add/remove, viewport? — must emit its
    inverse, which is a completeness obligation the audits would
    have to learn).  Batch boundaries are the natural transaction
    marks.
    **First measurement**: snapshot cost — bytes and milliseconds —
    at 100k elements, and restore cost; that number decides the
    fork before any API is designed.
42. **Viewport constraints** (raised 2026-08-19).  Min/max zoom
    exist; pan is unbounded, and "keep the graph on screen" is a
    perennial app-level reimplementation (the #1905 family's other
    half — round 75.5 takes the wheel *toggles*, not bounds).
    Scope: an optional pan/zoom constraint — clamp the viewport to
    the graph extent plus margin — with the semantics question
    being *where* the clamp lives (every viewport writer funnels
    through the camera; gestures, `fit`, animations and the
    constraint must agree, and the gesture feel — hard clamp versus
    rubber-band — is a design call).
    **First measurement**: the closed-issue inventory of what was
    actually asked for, then the writer inventory — every code
    path that sets pan/zoom, to confirm one funnel exists.
43. **The wire format goes public** (raised 2026-08-19).  Round
    46.5's binary format is 2.7× smaller at rest than JSON and
    fuzz-hardened since 48.3, but it is an internal fixture
    vehicle: undocumented, unversioned, no public API.  Promoting
    it means: a version/feature-flag header and written evolution
    rules (the format becomes contract — columns must be stable
    across releases or negotiated), a documented layout, a schema
    home beside round 79's, and public save/load on the core.
    The cost is the commitment, not the code.
    **First measurement**: what the current encoding lacks for
    evolution — is there any version field at all, and which
    column ids would break if the contract reordered.
44. **A v3→v4 codemod** (raised 2026-08-19).  `MIGRATING.md` is
    prose, but its property table is machine-checked
    (`test/modules/migration-guide.mjs`) — a codemod can be driven
    from the same data, so guide and tool cannot drift apart.
    Scope: the mechanical 80% (renames, option moves, event-name
    changes, `style()` → bypasses spellings), with the
    non-mechanical remainder *flagged, not transformed* — selector
    strings to the mapper DSL and style functions are design
    decisions, and a codemod that guesses them is worse than one
    that points.
    **First measurement**: run the candidate transform over v3's
    own documentation snippets and one real app's source, and
    count clean conversions versus flags versus misses.
45. **Typed element data** (raised 2026-08-19).  The shipped
    `d.ts` types `data()` as `any`-shaped; the ask is generics —
    `cytoscape<NodeData, EdgeData>( … )` — flowing through
    `data()`, the mapper DSL's field references, and event
    payloads.  Two risks make it measure-first: whether the
    `build:types` pipeline (rolldown-dts) preserves generic
    parameters end-to-end at all, and whether the sheet DSL's
    string-keyed field references can be typed without wrecking
    inference for the untyped default case (they must degrade to
    today's types when no generic is given).
    **First measurement**: a two-member prototype through
    `npm run build:types` — if generics survive to
    `dist/cytoscape.d.ts` with hover docs intact, the round is
    real; if not, the round is first a build-pipeline round.
46. **Framework bindings, React first** (raised 2026-08-19).
    `react-cytoscapejs` is stale and every consumer rebuilds the
    same lifecycle glue.  An official wrapper owns: mount/destroy
    (StrictMode's double-mount included), container resize, and
    prop-diffing that batches element/style updates instead of
    re-init.  Build it with round 71's toolchain — which doubles
    as cyext validation on a non-layout extension, the round-71
    plan's own stated risk.  Vue/Svelte follow the same skeleton
    if React proves the shape.
    **First measurement**: what the stale wrapper gets wrong
    against v4's lifecycle, enumerated — destroy timing, resize,
    double-mount, update batching — as the requirements list.
47. **A devtools panel** (raised 2026-08-19).  `debug/` already
    has the instruments — the stats overlay, frame timings
    (`gpu-timer.mts`), store counts — but they are welded to the
    harness.  The round packages an opt-in inspector for app
    developers: frame-graph timings, per-pipeline draw stats,
    store/dirty-tracking introspection, pick debugging.  Form
    factor is the design call: an in-page overlay an app enables,
    versus a browser-extension panel; the overlay is v1 (no
    extension-store dependency).
    **First measurement**: the dependency inventory — which of
    the harness's instruments read public API versus reach into
    internals, since that boundary decides what the panel can be
    without growing the public surface.
48. **PDF export over the SVG serializer** (raised 2026-08-19).
    Round 77 builds the SVG serializer; EnrichmentMap web ships a
    pdf-export extension today, so the first consumer exists
    before the feature does.  Publication figures are the driver
    (it is why #639 is the most-demanded export ever filed).  The
    hard part is text: fonts must embed or outline, and the
    fidelity question is whether an svg-to-pdf library preserves
    round 77's output or a direct PDF backend is needed.
    **First measurement**: run 77's output through the
    svg2pdf-class candidates, rasterize both, and diff — the
    parity harness round 77.5 builds is reusable verbatim.
49. **The layout portfolio — one excellent layout per use case,
    layered/hierarchical first** (maintainer, 2026-08-19: v4
    should ship a *better* set of built-ins than v3 — one really
    good layout per main use case, and "comparable to dagre" is
    the named bar for hierarchical).  Today v4 has grid, preset,
    circle, concentric, breadthfirst, random and the GPU force;
    round 85 adds radial tree, force constraints, `edgeLength`
    and per-side padding.  The audit: enumerate the use cases —
    layered/DAG, tree, force/organic, circular/attribute-grouped,
    component packing — and name the flagship for each, against
    what the ecosystem apps actually ship (Cytoscape Web carries
    three layout engines because the built-ins weren't enough;
    that is the demand signal).  The known hole is
    layered/hierarchical: nothing in v4 or the plan is
    Sugiyama-class (ranking, crossing minimization, coordinate
    assignment; compound-aware; port/edge-routing aware at the
    elk end).  Build-vs-port is the first call — dagre is
    unmaintained, elkjs is huge, and round 59's pattern (the CPU
    reference is the spec; GPU assist only where a phase is
    parallel) applies if built.
    **First measurement**: the use-case × current-coverage
    matrix, then a quality harness — crossings, edge-length
    variance, area, runtime at N — run over dagre and elkjs on
    real DAG fixtures, so "comparable to dagre" is a measured
    bar before anything is designed.
50. **The v3 extension ports** (maintainer, 2026-08-19: the most
    important v3 extensions need v4 ports).  Round 71 builds the
    toolchain and one example; this is the campaign that uses it.
    The list is not "all of them": several are absorbed by
    scheduled rounds — expand-collapse and bubblesets by 82,
    layers largely by 81, pdf-export by 77/item 48, dagre by item
    49 — and `eh`'s *look* returns via round 96's bypasses while
    the edge-drawing gesture itself still needs a port.  The
    likely port tier: fcose (both flagship apps), edgehandles,
    automove, popper, cxtmenu/context-menus, panzoom, navigator.
    Each port is also cyext validation on a different extension
    shape (gesture, layout, UI overlay), which is exactly the
    coverage round 71's example layout does not give.
    **First measurement**: rank v3 extensions by npm downloads
    and flagship-app usage, map each against rounds 71–97 for
    absorption, and let the remainder *be* the port list — with
    the first port chosen for shape-coverage, not popularity.

