# WebGPU model + renderer prototype (#3486)

**Status: implemented and evolving** on the `v4` branch (started as
`feature/webgpu`).  The base pass (11 commits, `e30542cf4..9b177c193`)
landed first — including SDF node labels, pulled into scope so labelled
rendering could be assessed for performance — and subsequent rounds
(follow-ups, API gap closure, the selector removal, mappers, animation,
image export, label testability, the round-10 parity sprint, round-11
slot-stable compaction, edge-label autorotate) are recorded below as
"Landed (round N)" sections, each verified green when it landed; the
round-12 curved-edges plan has both flagged calls signed off, pass
12a (bundled bezier + self-loops) landed 2026-07-30, and pass 12b
(unbundled bezier + segments + taxi) landed 2026-07-30/31, and pass
12c (endpoints + haystack/straight-triangle) landed 2026-07-30/31 —
**round 12 is complete**; the round-13 style-prop parity plan
(2026-07-30, at the end of this file) landed in full on 2026-07-31 —
**round 13 is complete** (12c → A1–A2 → B1–B7 → C1–C3 → D1–D4, every
item with Node specs plus a golden and/or a live v3 pixel-parity
scene); the round-14 compound-nodes plan (2026-07-31, at the end of
this file) landed in full the same day — **round 14 is complete**
(14.0 docs-first → 14.1–14.8 model/CPU → 14.9–14.11 renderer/
interaction → 14.12 benchmarks, every item tests-first with Node
specs, and the renderer items with goldens + live v3 pixel-parity
scenes).  A 2026-08-01 design sitting **dropped z-index outright**
(decided design) and scoped rounds 15–18 — background images,
multiline labels + label bb, the event vocabulary + extension
contract, and the GPU force layout — and all four rounds **landed in
full the same day** (plans + per-item records at the end of this
file; every item tests-first, 2142 Node + 60 module tests and
138 Playwright specs green at the close).  **Round 19** (2026-08-01)
landed slot-moving compaction — the last open architecture item —
and **round 20** (2026-08-01, the plan at the end of this file)
closed gap item 8: the interaction tuning options
(`wheelSensitivity`, the tap-threshold pair, `tapholdDuration`), the
`events`/`text-events` pointer-transparency props, and the
two-finger-cxt + three-finger-box touch gestures (2190 Node tests
and 147 Playwright specs green at the close).  A **third design
sitting** (2026-08-01) took three user calls and scoped rounds
21–23, all landed the same day: **round 21** removed the animation
queue (concurrency by channel, promises as the sequencing
mechanism), **round 22** split display/visibility (show/hide stays
the structural tier — now re-fanning bezier bundles — and the
`visibility` style prop is paint-only invisibility keeping space
and bundle ranks, via a derived FLAG_DRAWN and a one-line WGSL mask
flip), and **round 23** brought node charts (v3's 101 pie/stripe
props as the lean list-valued `chart` family — data-driven values,
scheme palettes, donut holes — with the pie parity scene at 0.000%
against v3; 2214 Node tests and 151 Playwright specs green at the
close).  Rounds 24–28 (2026-08-01/03) closed the remaining ledger
work — style transitions and the animation controls (24), the
geometry tweens (25), the authoring surface of JSDoc + shipped
declarations (26), the visual-parity remnants of v3's shape and
arrowhead vocabularies (27), and the no-call remainder (28) — after
which **what was left of the ledger was open calls rather than
effort**.  Rounds 29–30 (2026-08-03) therefore work a different axis:
not what is unbuilt but what is **unpinned** — the alias surface, the
decided drops at the API boundary and the curve premium in 29, and
v4's **error contract** in 30, which took the throw sites the Node
suite never runs from 34 to 0.  Rounds 31–32 (2026-08-03) stayed on
that axis and moved it onto the *documented* contract: 31 found the
one error message advising a form v4 rejects and took `@throws` to
16/16 under a gate, and 32 took `@param` to 221/221 under the same
gate, the boundary drawn by docmaker's own per-argument shape.
**Round 33** (2026-08-03, at the end of this file) took the same
question to the third measurement axis — *what costs what* — where
roughly a third of the prototype had no benchmark at all and the
report's job table ran half the suites that existed.  Fourteen suites
became 22, the report grew an `--all` profile that runs every one of
them (closing open call 7), and the round's most useful output is the
**five slow paths it found and localized** — the style getters, the
compound emit walk, the layout contract's per-run materialization,
`mutableElements()` and `indexOf()` — each logged rather than fixed,
because a measurement round measures.  **Round 34** (2026-08-03) then
fixed all five: three now sit at parity with v3 (`indexOf`,
`mutableElements`, and the emit path's new no-listener gate), the style
getters went 5.8× → 2.3× by memoizing `normalizeProp`, and the layout
contract's per-run cost fell 333 µs → 795 ns.  Two of the five findings
were **corrected while being fixed** — the style gap was inflated by
tsx's `__name` wrapper, and the row round 33 cited for the emit finding
never reached the emit path — which is the round's own lesson: check a
hot-path finding against the built bundle before rewriting anything.
**Round 35** (2026-08-03) came from the maintainer asking why the
residual was shaped the way it was — a 150-case switch behind the style
getters — and replaced it with a dispatch table, which *flattens* the
per-property spread (5.1× → 2.3×) rather than uniformly lowering it.
**Round 36** (2026-08-04) is the **completion round**: with the rest of
this file's remainder being open calls, it took the tail that needs no
decision — `@returns` to 276/276 (written, deliberately ungated), the
`@param` gate's own blind spot (exported functions; 229/229), the
browser-only throw tier closed by four specs and three
reclassifications, the two un-benchmarked collection members, and three
measurements promised here and never taken.  It also shipped a
**stranded-doc-block check**, which found six more instances of this
codebase's most repeated documentation defect on its first run — one of
them shipping in the declarations.
A **fifth design sitting** (2026-08-04) then took **every open call in
the ledger** with the maintainer and scoped the **production-readiness
roadmap**: rounds 37–50, from the governance close-out (gates, the alias
split, the strictness closures) through the full `border-style` port, the
v4 Event, the `v3/` repo restructure that makes v4 the package's default
export, the docs generator and v4 site, the migration guide, robustness
and cross-platform passes, to a published **4.0.0**.  The per-item
decisions are recorded in "Open calls for the maintainer" below; the
sitting record and the round 37–50 plans are at the end of this file.
`src/gpu/README.md` is
the maintained scope / deviations doc; this file records each round's
plan and outcome.

## Process (applies to all work under this plan)

- **Isolated commits as you go.**  Every item lands as its own
  commit(s) with a detailed message — never batch unrelated changes,
  and never leave a round's work sitting uncommitted.
- **Docs travel with the code, every commit.**  Each commit updates
  `src/gpu/README.md` (scope / deviations / design decisions) and this
  file — including the logbook: the round records ("Landed (round N)"
  sections and their verification notes) are written or amended in the
  same commit as the work they describe, not batched at the end.
- **A closing docs sweep ends every round** (rule added 2026-08-01,
  after the post-round-19 sweep caught drift the per-commit rule had
  missed).  Per-commit doc updates track the sections a change
  obviously owns; the long-lived overview sections — the directory
  layout, the follow-up/open-hooks lists, the README header and
  "Follow-up hooks", cross-references like "still open"/"remains" —
  belong to no single commit and drift silently.  So once a round's
  last item lands, sweep both docs end to end before calling the
  round complete: grep for the round's own vocabulary and for
  staleness markers ("open", "remains", "planned", "not yet", stale
  counts and file lists), verify every section the round touched
  reads true, and land the fixes as the round's closing docs commit.
  **Sweep this file too, not just the README** (amended 2026-08-02,
  after round 27's sweep did the README end to end and left
  PLAN.md's own gap ledger asserting that shape keywords, compound
  arrows and numeric `text-rotation` were still unbuilt — the round
  had just built all three).  **Three** places here drift on almost
  every round and are worth grepping by name: the **"Needs a call"
  gap ledger**, whose per-item "Still open:" lines outlive the work
  that closes them; the **"Suggested sequencing"** summary of what
  remains; and — added 2026-08-03 — **"Gaps with direction already
  set"**, which had gone *seventeen rounds* without a sweep: seven of
  its eight entries still described landed work as pending, and its
  z-index entry still promised to restore `zDepth`/`sortByZIndex`
  two days after z-index was dropped outright.  A round record is not
  the whole record.
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
that executes it (rounds 37–50, planned at the end of this file).  The
one question that stays genuinely open is the **error policy** inside
item 4 — the maintainer flagged it for real design work rather than a
quick answer — which converts into round 40's design sitting instead of
closing here.

**Round 37 has since landed** (2026-08-04), executing the four items it
owns: item 8 (both audits now gate), item 9 (the alias split), item 10
(constructor strictness at the type layer) and item 11 (event names
stay open, documented).  Each is marked below.  The rest still read as
described until their rounds ship.

### Scope calls

1. **`border-style` / `outline-style`** (27.8, 2026-08-02) — the last
   unported v3 style pair.  Technique settled, cost known in three
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
6. **A v4-specific event type** (logged 26.5) — v4 emits the shared v3
   `Event`, so `event.target` types as `unknown` in the shipped
   declarations.  A v4 event type is a design call, not an oversight.
   **Call taken (2026-08-04): build the v4 Event** — v4 gets its own
   Event class *and emitter* (severing the last shared-module import
   of v3's `src/emitter.mts`, a prerequisite of the round-42
   restructure): typed `target`, `originalEvent` populated by the
   pointer layer, **`preventDefault()` supported and functional** (the
   preventable gesture defaults are enumerated at the round's
   docs-first stage), and **no namespace machinery at all**.  Executes
   as **round 41**, resolving item 12 with it.
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
   `scripts/gpu-throw-coverage.mjs` reports it and deliberately does
   not enforce it, because a floor is a policy call with three parts:
   whether a **new Node-reachable throw with no spec should fail the
   build** (the reading is 0 today, so a zero-tolerance gate would
   hold as of this round); what to do about the **browser-only
   sites** (13 when this call was written, 10 since round 36.4), which
   the Node measurement cannot see at all and which only the `webgpu`
   project can pin; and whether the
   `UNREACHABLE`/`MISATTRIBUTED` lists are a maintained allowlist or a
   one-off note.  The JSDoc-coverage precedent (a script plus a test
   that gates it) is right there, so this is a decision about appetite
   rather than about mechanism.
   Note that rounds 31.2 and 32 *did* gate the two documentation
   rules (`@throws`, `@param`) in `test/gpu-jsdoc-coverage.mjs`, on the
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
   two rows in `test/gpu-aliases.mjs`, their wiring and `declare`
   lines in `core.mts`, and the `roundrectangle` line in
   `test/gpu-decided-drops.mjs` come out together.
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
    wrong on the second half**.  v4 imports v3's emitter, so namespaces
    parse and work in full v3 semantics: `on('tap.ns')` listens for
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
    machinery is live, in full v3 semantics, and only v4's own emits
    are unqualified.*
    **Call taken (2026-08-04): event names stay open — no denylist.**
    v3 supports custom events (`node.emit('foo')`) and v4 keeps that,
    so names cannot be gated; dropped v3 spellings register and simply
    never fire, documented as such.  **Closed by round 37.4** (docs +
    specs, no runtime change), which also corrected the namespace half
    of this item: the machinery is live, not merely unexercised — v4
    never *emits* a qualified name, but a hand-emitted one behaves as
    it does in v3.  **Round 41.2 removed the machinery** while leaving
    names free, as planned.
12. **`event.preventDefault()` exists and does nothing** (recorded in
    the README since round 27's fact-check).  v4 emits the shared v3
    `Event`, so the method is present on every event a handler
    receives and sets `isDefaultPrevented`, but no v4 code reads that
    flag — gesture defaults are gated by options instead.  Same
    family as 10: the call is whether it throws, is removed from the
    v4 event, or stays documented-as-inert.
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


## Context

Issue #3486 specs a v4 performance redesign: columnar/GPU-native model, persistent GPU buffers, WebGPU rendering. This first pass (originally on `feature/webgpu`, branched from the TS refactor PR #3477; the work now lives on `v4`) builds a **separate v4-style prototype** — not a mode of the canvas renderer like WebGL. It ships a new GPU-oriented data layer with the familiar synchronous core/element API on top, plus a WebGPU render pipeline. The existing v3 core, collection, and renderers are **not modified**.

Agreed constraints (from user) — the **pass-1 agreement**, kept as the historical baseline: nearly every "No" below has since landed in rounds 6–19 (animations, the sheet + mapper styles, layouts, algorithms, compound nodes, `data()`, arrows, curved edges, ...); the sections and round records below track what actually shipped.
- **CPU-canonical columnar model**, write-through to persistent GPU buffers via dirty-range uploads. Sync API reads always hit CPU typed-array columns. Model works headless (Node-testable, no GPU). ✅
- **Parallel core** in a new directory with its own entry point; familiar API shapes. ✅
- **API scope**: core — viewport fns, events, graph manip, grid layout only. Collections — events, graph manip, position/dims, iteration, comparison, building/filtering, basic traversal (outgoers etc.), select/unselect. **No**: animations, stylesheets (constrained compiled-style blocks instead, constants only, no mappers), other layouts, algorithms, compound nodes, `data()` (deferred; ids/source/target are first-class). ✅ — with one deliberate scope addition: the `label` style prop accepts the single mapper `data(id)`, since ids are first-class.
- **Rendering scope**: SDF node shapes, straight edges (endpoints read from node position buffer on-GPU), GPU picking, basic culling/LOD. Originally **no labels or arrows**; **SDF labels were added** in the follow-up commits (see below). Arrows remain out. ✅
- **Hard error** when WebGPU unavailable (only when a container is given; headless never throws). ✅

## Directory layout (as built)

```
src/gpu/
  index.mts              # default factory cytoscapeGpu(options); hard-error gate; wires model↔renderer↔pointer
  gpu-types.mts          # public option/type surface (GpuRendererOptions LOD knobs, RendererStats, ...)
  core.mts               # GpuCore facade: graph manipulation, queries, events, style(), layout(), pick(),
                         #   batching, compact() (round 19), json()/serialize(), destroy(), width/height
  collection.mts         # GpuCollection ("element is a length-1 collection", v3-style; interned handles;
                         #   epoch-guarded _refs with post-compaction lazy repair, round 19.3)
  viewport.mts           # zoom/pan/panBy/fit/center/extent state + math (core-owned; core emits the events)
  event.mts              # v4's Event object (41.1): typed target, originalEvent, no namespaces
  emitter.mts            # v4's emitter (41.2), replacing the v3 import it had reused
  events.mts             # the one core emitter's wiring: ref/predicate-qualified listeners, the 14.5 phase rules
  matcher.mts            # query objects compiled to per-group (mask, want) flag tests + data conditions
  style.mts              # StyleEngine: sheet blocks compiled into channel columns + label sidecar
  style-scales.mts       # mapper DSL: object specs compiled to a closure-free IR + CPU evaluator
  style-schemes.mts      # named color schemes (viridis, ColorBrewer, ...) + sRGB↔OKLab
  easing.mts             # compileEasing: one curve layer shared by the CPU tick and the GPU kernels
  curve-geometry.mts     # CPU twin of the curve WGSL (rounds 12a-c): frames, routes, corners, bounds
  columnar.mts           # the columnar elements form: validation + toColumnarElements converter
  wire.mts               # the binary wire format: serializeElements/deserializeElements + cy.serialize()
  element-defs.mts       # classic definition-form parsing shared by the factory and cy.add()
  image-registry.mts     # round 15: the unique-image pool (url dedup, tiers, async decode)
  label-wrap.mts         # round 16: multiline breaker/justify/ellipsis + the headless estimator
  animation.mts          # Animation + AnimationManager: CPU tween, concurrent per-channel runs (round 21 — no queue); routes position/paint to the GPU sink
  layout/                # grid, preset, circle, concentric, breadthfirst, random
    contract.mts         #   round 17: the extension contract (CustomLayout + the columnar LayoutContext)
    force-sim.mts        #   round 18: the CPU reference force simulation (the kernels' spec)
    force.mts            #   round 18: the built-in force layout (contract consumer; picks the executor)
  algorithms/            # round 10: the full v3 algorithm surface, slot-native over CSR
  shape-points.mts       # unit polygon + arrowhead point tables shared by WGSL gen + CPU pick (round 10;
                         #   round 27 added the round-corner indirection, the compound-arrow parts and
                         #   the computed ARROW_MAX_BACK quad bound)
  store/
    graph-store.mts      # GraphStore: tables + indexes + sidecars; mutation API; compact() (round 19)
    table.mts            # ColumnTable: typed-array columns, x2 growth, free-list, generations, compact()
    id-map.mts           # string id ⇄ slot dictionary, blob-native (UTF-8 blob + probe table; round 11 reclaim)
    adjacency.mts        # CSR adjacency (two counting passes) + per-node overlay for incremental adds
    hierarchy.mts        # round 14: compound parent links, depth, child lists, the parent draw permutation
    curve-index.mts      # rounds 12a-c: bundle/loop membership + curve-param derivation
    curve-blob.mts       # variable-length record pools (curve params, polygons, images) + waste reclaim
    data-store.mts       # the data() sidecar: per-(group, key) adaptive columns, dict reclaim
    dirty.mts            # DirtyTracker: per-column coalesced [min,end) span, resized flag, touch() for sidecars
  contract.mts           # model↔renderer contract: ColumnId specs, flag bits, ModelView, StoreDelta, LabelEntry;
                         #   also the shared field packings (round 27.1: arrow ids, the node shape byte)
  gpu-context.mts        # adapter/device/canvas configure, device-lost handling
  render/
    renderer.mts         # frame graph: rAF render-on-dirty loop, pass ordering, stats(), pick/export driving
    column-mirror.mts    # GPU storage-buffer mirror; dirty-span writeBuffer; realloc+full re-upload on resized
    cull.mts             # compute cull pre-pass: three-dispatch stream compaction + indirect args per group
    node-pipeline.mts    # node render + depth-prepass pipelines (SDF shapes, vertex pulling)
    edge-pipeline.mts    # straight-edge pipeline (endpoints fetched from the node position buffer)
    curved-edge-pipeline.mts   # rounds 12a/b: the curved stream (24-quad strips off the params + blob)
    arrow-pipeline.mts   # straight-end arrowheads (SDF point tables, boundary tips)
    curved-arrow-pipeline.mts  # curved-end arrowheads (end tangents off the route)
    label-pipeline.mts   # SDF label pipeline (glyph instances; draws after nodes; not pickable)
    label-layer.mts      # consumes the label-dirty channel; shaping memo; lays glyphs into the GlyphBuffers
    label-layout.mts     # pure glyph layout (Node-testable)
    glyph-atlas.mts      # runtime SDF atlas: canvas-2D raster → exact EDT → shelf-packed r8 texture
    glyph-buffer.mts     # persistent glyph-instance buffers: per-owner ranges, tombstones, compaction
    mapper-runtime.mts   # GPU mapper eval: program/stop/data packing + the per-frame runtime
    mapper-shaders.mts   # the eval kernel WGSL (scale math mirrors style-scales.mts)
    gpu-tween.mts        # GPU tween runtime + kernels (position/scalar/color; per-slot from/to)
    gpu-force.mts        # round 18: the on-device force integrator (grid/gather/apply + lease)
    image-arrays.mts     # round 15: tiered rgba arrays + mips + the r8 icon array + image table
    image-pipeline.mts   # round 15: the image compositing draw (own pass off the node streams)
    chart-pipeline.mts   # round 23: the pie/stripe chart draw (own pass, after images)
    node-layer-pipeline.mts    # round 13 A2: overlay/underlay layer quads
    image-decoder.mts    # round 15: the browser rasterizer (fetch/createImageBitmap/svg canvas)
    cpu-pick.mts         # synchronous CPU node pick: shader-semantics replica over the columns
    picking.mts          # r32uint pick tile, 3-buffer staging ring, latest-wins + full-ring deferral
    gpu-timer.mts        # timestamp-query wrapper behind stats().gpuFrameMs
    scale-controller.mts # adaptive render scale: GPU-time-driven band controller
    upscale.mts          # Catmull-Rom bicubic upscale pass for scaled frames
    quad-index.mts       # shared indexed-quad index buffer
    shaders.mts          # all WGSL as template-literal strings
    webgpu-constants.mts # numeric usage/stage flags so render modules stay Node-importable
  interact/pointer.mts   # pointer/wheel/touch: pan, zoom, hover, taps, box select, drag, pinch, cxt
  README.md              # scope + accepted deviations (the maintained doc)
debug/webgpu/            # dev harness: network/bg/LOD/labels URL params, ?gen=NxM generator, ?layout=force|spiral|... (rounds 17-18), stats overlay
playwright-page/webgpu.html (+ parity.html for the live v3-vs-v4 diffs)
playwright-tests/webgpu.spec.js (+ webgpu-visual.spec.js + goldens/)
test/gpu-*.mjs           # 120+ Node-runner suites (auto-picked-up by the test:js glob), incl.
                         #   gpu-style-readback-all.mjs — round 35.1's characterization of all 153
                         #   readable style props on a node and an edge, the guard the readback
                         #   dispatch table was refactored behind
benchmark/gpu/           # 23 suites + the renderer/report runners (see the Benchmarks section of the README).
                         #   Round 36.5 added style-bundle.mjs — the style getters measured through the
                         #   *built bundle*, giving rounds 34-35's headline figures a re-runnable source.
                         #   Round 33 added layouts, style, load, spatial, data, events, store and
                         #   surface (the breadth pass) to the round-1..29 set, and report.mjs grew
                         #   an --all profile that runs every one of them (closing open call 7).
scripts/gpu-bench-coverage.mjs   # round 33.12: which public members a benchmark calls (reports, never gates)
test/modules/gpu-bench-coverage.mjs  # round 33.12: that script's matcher, and the limits it errs within
scripts/gpu-jsdoc-coverage.mjs   # round 26: the two-tier JSDoc audit (--verbose lists every miss);
                                 #   also @throws accuracy (31.2), @param completeness (32, widened in
                                 #   36.2 to exported functions), @returns (36.1) and stranded doc
                                 #   blocks (36.6) — the last two report, never gate
test/gpu-jsdoc-coverage.mjs      # round 26: the coverage gate (no file may regress), + the 31.2/32 rules
test/modules/gpu-jsdoc-returns.mjs   # round 36.1: the @returns audit's parser, against a fixture
test/modules/gpu-jsdoc-stranded.mjs  # round 36.6: the stranded-block check, and the limits it errs within
scripts/gpu-throw-coverage.mjs   # round 30.4: which src/gpu throws the Node suite runs (reports, never gates)
test/modules/gpu-throw-coverage.mjs  # round 30.4: that script's lcov parser, against a fixture
rolldown.dts.gpu.config.mjs      # round 26.5: rolls src/gpu declarations up (build/dts-gpu/)
build-dts.mjs                    #   finalizeDts (v3) + finalizeGpuDts (v4) -> dist/*.d.ts
dist/cytoscape-gpu.d.ts          # round 26.5: the shipped declarations behind the "./gpu" types export
test/types-gpu-surface.mjs       # round 26.5: shape audit (exports, statics, surviving doc blocks)
typescript/tests/gpu.test-d.ts   # round 26.5: compile-only consumer test in the test:types project
```

## Model half — implemented as planned

Columns, flag bits and shape ids are exactly as originally specced; `contract.mts` is the co-signed source of truth and was implemented first. Key decisions that held up:

- **Stable slots**: free-list + tombstones (cleared flags) + per-slot generation counters; renderer draws `highWater` instances, dead ones collapse to degenerate quads in the VS. No compaction in pass 1 (since landed: the slot-stable tier round 11, slot-moving round 19).
- **Dirty tracking**: one coalesced `[min,end)` span per column per frame + `resized` flag; `takeDelta()` returns-and-clears; `onInvalidate(cb)` fires ≤ once per microtask. Extended with `touch()` so non-column sidecars (labels) join the same scheduling.
- **Adjacency**: incremental per-node `outEdges[]`/`inEdges[]` (O(1) degree, cascade removal). CSR deferred.
- **Element handles**: interned singleton length-1 collections per live slot; `{group, slot, gen}` refs validated on access; cached `id()`/`group()` stay readable after removal (needed for `remove` events).
- **Events**: single core emitter (v3's `src/emitter.mts` unmodified at pass 1; v4's own since round 41.2) with per-ref listeners for collections and selector qualifiers for the core. Emitted: add, remove, position (skipped when no listeners), select, unselect, zoom, pan, viewport, fit, layoutstart/ready/stop, style, render, destroy, error, tap, mouseover/mouseout.
  - **No event namespaces**: v4 drops namespaced events (`'tap.foo'`) — they are unused and cost a per-emit parse on the hot path. `emit()` treats an event string as bare type(s) only; the shared emitter's namespace parsing (retained for v3) is simply not exercised by v4. Listeners/emits should use plain type names.
- **Style**: constant blocks on `node|edge|*|#id` + `:selected/:unselected`; node channels background-color/width/height/shape/opacity/border-*, edge line-color/width/opacity; **plus label/font-size/color** (label sidecar, `data(id)` allowed). Applied on setBlocks, add, and select/unselect. Equal-radii ellipses compile to the exact circle SDF.
- **Grid layout**: cell-packing math ported verbatim; bulk `store.setPositions` (one dirty span) + layout events; `cy.layout({name})` errors on anything but `grid`.
- **Positions**: Float32 canonical; headless dims via `headlessWidth/headlessHeight` (800×600 defaults).

## Render half — implemented as planned, plus labels

- **Init/ready/device-lost**: as specced (sync throw without `navigator.gpu`; `.ready` rejects on null adapter; premultiplied canvas; dead instance + `error` event on loss).
- **Frame uniform**: 48-byte struct at pass 1 — viewportPx, panPx, zoomDpr, edgeWidthFloor, nodeLodPx, hidePx, edgeDim, labelFadePx. Not a mat3x3, as planned.  (Since grown to 17 fields / 72 bytes: labelMinPx, the curve/haystack/outline slack bounds, arrowScaleMax, imageMinPx, and the round-20.2 pickMode.)
- **Node/edge pipelines**: pure vertex pulling from the mirrored columns; colors bound as `array<u32>` + `unpack4x8unorm` (byte-identical uploads); border band + selected accent ring (#0169d9) + hover/grab brighten in the node FS; edges extrude in screen space and fetch endpoints from the node position buffer (drags follow on-GPU).
- **Z-order**: single pass — edges, then nodes, then labels; slot order within a group. **Early-z (added)**: a depth buffer + node depth prepass (opaque interiors only, conservative cheap SD tests, no Newton solver) kills edge fragments under opaque nodes before blending; depth = per-element z-rank (edges far / nodes near), designed to generalize to `z-index`/compound ordering as more ranks + batches. Pixel-identical output (verified by screenshot diff); ndex-x-large fit-all at dpr 2: 37.7 → 31.4 ms.
- **ColumnMirror**: per-column storage buffers, span uploads at `start × bps`, realloc + full re-upload on `resized` with `destroy()` deferred behind `onSubmittedWorkDone()`, version-bumped lazy bind-group rebuild. Unit-tested against a mock GPUQueue.
- **Picking**: r32uint id target, same draw order, ids 0/slot+1/high-bit-edge; latest-wins requests through a ring of 3 staging buffers (a full ring defers the pending request to the next frame with a free slot — drop-to-null was removed by the 2026-08-01 pick-ring look at the end of this file). Exposed as `cy.pick(x, y)`. Reworked after the initial pass (the original full-scene pick pass + unbounded frame queueing made hover picks take ~1 s on GPU-bound graphs): the pick pass now draws a fixed 64×64 cursor-centered tile — a pick-specific Frame uniform whose viewport is the tile turns the shaders' own conservative culling into cursor-region culling, O(region) not O(scene) — submits in its own command buffer ahead of scene work, reads back a single center texel, and pick-only frames skip the scene pass entirely. Scene submissions are capped at 2 in flight (backpressure; a behind GPU coalesces state into the next frame instead of queueing deeper). Result at 100k×300k: hover-while-panning pick latency ~956 ms → ~70 ms median, idle picks ~58 ms → ~13 ms.
- **Culling/LOD**: originally VS conservative collapse; now a **compute cull pre-pass + drawIndexedIndirect** per group (nodes, edges, glyphs) — a deterministic three-dispatch stream compaction (count / serial scan / scatter with a workgroup Hillis-Steele scan) that preserves slot order, with an exact Liang-Barsky segment-vs-rect test for edges; the pick pass reuses the kernels with the pick-tile uniform (O(region) picks). LOD: edge width floor with alpha compensation; **far-zoom edge decimation** (below half alpha, a hash-stable 1-in-N subset at N× alpha, N ≤ 64); plain-disc nodes below ~3 px; sub-pixel size flooring with alpha compensation; optional zoom-based edge dimming. Indexed instance quads (4 VS invocations per quad via vertex reuse). Node decoration columns moved to the fragment stage (flat-instance fetch) to stay within per-stage storage-buffer limits. ndex-x-large pan benchmarks (GPU ms/frame): far zoom 33 → 3.5; zoomed-in 20× at dpr 1 12.4 → 8.8; fit-all at dpr 1 18.5 → 10.2; labels at 117k glyphs now ~free (38.6 vs 37.7 ms at dpr 2 fit-all).
- **Labels (added)**: runtime SDF glyph atlas (TinySDF-style canvas raster → exact Euclidean distance transform → one shelf-packed 1024² r8 texture, glyphs added lazily; edge encoded at sample 0.5, fwidth-AA in the FS). Persistent glyph-instance buffer (40 B/glyph) with per-node ranges, tombstones + compaction, coalesced span uploads and ColumnMirror realloc rules. Glyph instances reference the **node slot**, so labels follow drags/layouts on-GPU with zero rebuild (a node move uploads 8 bytes). Labels fade out below `labelFadePx`; single-line, centered below the node, not pickable.
- **Interaction**: wheel zoom-about-cursor, drag pan, throttled latest-wins hover picking (HOVERED bit + mouseover/mouseout), pan-vs-grab via an exact synchronous CPU node pick (no staleness), node drag through the core position API, tap-toggle selection (shift additive, background clears). Hover picking pauses during viewport-only gestures (pan drags never pick; wheel zooms suppress picks and re-pick once settled). Pinch deferred.
- **Pick fast paths (added)**: nodes pick synchronously on the CPU (columnar scan replicating shader semantics — flooring, plain-disc LOD, shape tests, topmost wins; unit-tested); the GPU tile (now edges-only) reads back whole and doubles as a cursor-region pick cache invalidated on viewport/geometry changes. ndex-x-large at dpr 2: node hover ~0 ms, cold edge/background ~7 ms, cached ~0.2 ms, hover-while-panning median ~0 ms (was ~70 ms), with zero GPU pick passes for node hovers and cache hits.
- **Frame timing**: `stats()` reports `cpuFrameMs` (encode/submit cost, ~0.1 ms by design) separately from `gpuFrameMs` (real frame GPU time via the optional `timestamp-query` feature — the span across the cull/render/upscale passes, which is robust to backends that emulate pass-boundary timestamps at command-buffer granularity) — CPU-side timers cannot see GPU execution, which is what bounds fps on large graphs.
- **Adaptive render scale (added)**: `renderScaleMin`/`renderScaleMax` band (defaults 0.5/1), quarter steps driven by median `gpuFrameMs` over ~400 ms windows (drop > 14 ms; raise only when the projected cost at the higher step fits under 10 ms — no pumping; backpressure stalls as the no-timestamp fallback; pure `ScaleController`, unit-tested). Idle settles back to max after ~250 ms so stills are always native — chosen over a static scale because far zoom is maximally resolution-sensitive (floors are render-px-defined, sub-pixel statistics change, decimation engages earlier) yet nearly free at native after decimation+culling. Scaled frames render offscreen + Catmull-Rom bicubic upscale (9 bilinear taps). Verified: fit-all pan at dpr 2 steps 1 → 0.75 → 0.5 within ~0.8 s (25 → 76 fps, 8.3 ms GPU); idle returns to 1; far-zoom pan holds 1. Picking stays native; `labelMinPx` option hard-culls unreadably small labels in the glyph cull predicate.

- **Whole-graph fit fast path (added)**: no-arg `fit()`/`center()` compute bounds via `GraphStore.boundingBox()` — a direct columnar scan (nodes: position ± size/2 + border/2; edges as a first-class extent term, today the endpoint centers) instead of materializing ~500k element handles through `cy.elements()`. ndex-x-large: 235 → 15 ms, identical zoom/pan. Future edge geometry (bezier, arrows) extends the edge term in the store scan and `GpuCollection.boundingBox` together.  (Since superseded: round 12a extended the store scan's edge term with the conservative curve-hull bound and gave `GpuCollection.boundingBox` the exact lazy curve tier.)

## Integration — done

- devDep `@webgpu/types`; tsconfig `"types": ["@webgpu/types"]`.
- rolldown: `build/cytoscape-gpu.umd.js` (global `cytoscapeGpu`) + `build/cytoscape-gpu.esm.mjs`; the `FILE=umd` watch filter picks the gpu UMD up automatically (verified).
- package.json: `exports["./gpu"]`, gpu bundles in `dist:copy`, `debug/webgpu` in `watch:sync`.
- `debug/webgpu/`: network/bg/LOD/labels URL params, `?gen=NxM` random-graph generator, best-effort constant-prop conversion of the v3 fixture styles, FPS/counts/upload-bytes/glyphs/pick-latency overlay.
- playwright: `webgpu` project — `channel: 'chromium'` new headless + `--enable-unsafe-webgpu --enable-unsafe-swiftshader`, loading via `http://127.0.0.1:3333`; soft-skips without an adapter; the default chromium project ignores the webgpu spec.

## Verification — all green (the pass-1 record; each later round's Landed section carries its own tallies)

- **Node tests** (`npm run test:js`): 16 gpu suites / ~240 gpu assertions within the 918-test suite — store, dirty contract, core graph manip, collection iteration/comparison/building-filtering/traversing, selectors, selection, events, viewport, style, grid layout, ColumnMirror (mock GPUQueue), labels model channel, label layout/EDT/GlyphBuffer.
- **Playwright** (`webgpu.spec.js`, 10 specs on a real Metal adapter): ready; hard error with `navigator.gpu` removed; headless never requires GPU; red-node-on-white composited pixels (pins premultiplied compositing); pick() node vs background; mouse-drag moves node in model + pixels; tap select/clear; label renders below node; label follows a move with ≤64 B upload; label LOD fade-out.
- **Manual/scripted**: `?gen=` harness runs verified via scripted Chromium (render-on-dirty confirmed: 1 frame while idle); typecheck and lint green.

### Benchmark (Apple Silicon Metal, 1280×800, continuous-pan steady state)

| | 25k nodes / 50k edges | 100k nodes / 300k edges |
|---|---|---|
| Glyph instances | 139k | 589k |
| FPS fit-all, labels off → on | 73 → 73 | 41 → 37 |
| FPS zoomed-in, labels off → on | 74 → 74 | 38 → 31 |
| One-time glyph build | ~0.8 s | ~4.1 s |
| Extra GPU upload for labels | +5.2 MiB | +22.5 MiB |

CPU stays ~0.1 ms/frame throughout — the renderer is GPU-bound (instance count in the VS). Steady-state labels are near-free at fit-all zoom (LOD collapse) and cost ≤~18% zoomed in at the 100k scale.

## Known deviations (accepted; detailed in src/gpu/README.md)

- Element/core listener firing order is registration order *within a bubbling phase* (compound bubbling landed round 14.5 with v3's cross-phase order).
- No z-index; compound parent bodies (round 14.9, depth order) under edges under leaf nodes under labels; within a stream, slot order (reused slots draw at the recycled position).
- Float32 position precision (~7 significant digits).
- Pan-vs-grab uses the ≤2-frame-stale resolved pick.
- `cy.elements()` returns nodes then edges, not mixed insertion order.
- Labels: nodes only, single-line, fixed below-node placement, not pickable, fixed-size atlas, color/text baked per glyph run.  (Since superseded: edge labels + label visuals landed in round 10; edge-label autorotate 2026-07-29.)
- `data()`, arrows, compounds, bezier, non-grid layouts: all since landed (animations round 9; circle/concentric/breadthfirst/random layouts round 10; the full curved-edge families rounds 12a–12c; **compound nodes round 14**; GPU layouts stay logged).

## Follow-ups (informed by the benchmark)

1. ~~Compute-shader culling + `drawIndirect`~~ — done (see the culling/LOD
   section above).
2. ~~Batch the one-time glyph build~~ — **dead on re-measurement**: 100k
   labels (588,890 glyphs) build in ~160 ms (~1.6 µs/label; init-time delta
   110 ms wall), not the ~4.1 s / ~40 µs per label originally recorded.  The
   build path is unchanged since labels landed, so the original figure did
   not survive a controlled re-measurement (runtime `style()` apply → stable
   frame, CPU-profiled).  SDF raster/EDT is per *unique* glyph and cached in
   the atlas; per-label work is layout + instance emission only.
3. ~~Bulk element load~~ — **done** (the actual init bottleneck).
   Profiling the ndex-x-large load (28.6 MB JSON, 19.6k nodes / 465k
   edges, ~960 ms end to end) showed `cytoscapeGpu` init at 662 ms —
   dominated not by the columnar model but by eager per-element handle
   materialization (`GpuCollection` interning for 484k elements the loader
   never touches), a per-element `add` emit with no listener early-out,
   def-clone churn and the ~110 ms GC echo.  Landed as two pieces: (a) a
   bulk add path — no handles or emits on the factory load, clone-free def
   partitioning, one up-front table reservation, and `applyBulk` (the mini
   selector language resolves per (group, selected), not per element) —
   init 662 → 236 ms; (b) a **columnar elements form** (`{ columnar:
   true, ... }`, typed-array columns, integer-indexed edge endpoints,
   contiguous-slot memcpy ingest) with the compat converter
   `cytoscapeGpu.toColumnarElements(json)` — init 236 → 80 ms, and ~76 ms
   with a prebuilt payload (what fetching a binary format would enable;
   `JSON.parse` itself is 90–113 ms on this fixture).  The serialized
   wire layout for the columnar form is also **done**: one little-endian
   ArrayBuffer (header + columns; ids as a UTF-8 blob + prefix offsets
   with an ASCII fast path) via `cytoscapeGpu.serializeElements` /
   `deserializeElements`, accepted directly by
   `options.elements`/`cy.add()`.  Numeric columns deserialize as
   zero-copy views; deserialize is ~5 ms on this fixture (replacing the
   90–113 ms parse + 27–48 ms convert of the JSON path) and the payload
   is 9.2 MB vs 30 MB JSON.
4. ~~`data()` sidecar~~ — **done**, columnar like everything else:
   per-(group, key) adaptive columns (f64 + presence for numbers,
   dictionary-encoded strings, plain-array fallback), `ele.data()` with
   v3 semantics (immutable id/source/target, `data` events), ingest from
   defs, columnar `data:` columns and the wire (v2 data blocks — f64 and
   dictionary indices deserialize zero-copy).  Labels now take any
   `data(key)` mapper and refresh on data writes.
5. ~~Perf round 2 (post-load-path)~~ — **done**: (a) grid layout got a
   slot path (no handles; bulk `setPositions`; 200k nodes 270 → 24 ms)
   plus a new **preset layout**; (b) the id index went blob-native —
   UTF-8 blob + open-addressing probe table, no stored JS strings, lazy
   per-slot decode; packed wire ids ingest with zero string
   materialization (484k ids: ~69 ms Map inserts / ~50 MB → ~10 ms /
   ~9 MB); (c) adjacency is CSR built in two counting passes from the
   endpoints column, with a per-node overlay for incremental adds
   (~15.5 MB of per-node arrays → ~4 MB).  Wire-payload init on
   ndex-x-large: ~106 → 68 ms median (deserialize itself ~0 ms).
6. ~~Cheap wins remaining: arrows, pinch zoom~~ — **done**.  Triangle
   source/target arrowheads render as one quad per visible edge per
   enabled end off the edge cull stream, tips on the endpoint node's
   boundary computed on-GPU (drags/layouts need no rebuild); the vertex
   stage stays within WebGPU's base 8-storage-buffer limit (per-end
   color column binding; edge opacity folded into stored arrow alpha).
   Two-finger pinch zooms about the touch midpoint with grab
   cancellation and an inert leftover finger.  Playwright also runs on
   WebKit now (classic renderer specs green; WebGPU specs soft-skip
   until Playwright's WebKit build ships navigator.gpu).

All follow-ups are done.  The open hooks this list once tracked have
all since closed: ~~slot compaction~~ (slot-stable tier round 11;
slot-moving round 19), ~~z-index ranks~~ (z-index dropped by decided
design 2026-08-01), ~~compound nodes~~ (round 14), ~~curved edges~~
(rounds 12a/12b/12c), ~~a binary export of live graphs~~
(`cy.serialize()`, round 10), and mappers landed as the round-7
object DSL below.  "More layouts" remains demand-gated (the round-17
extension contract is the vehicle).

## API gaps vs v3

Pass-1 scope held, but a lot of the familiar v3 core/collection surface
was missing.  The **LHF** (buildable on the existing columnar/flag/
adjacency model with no new architecture) and **small-touch** (one
localized store/renderer/pointer change, no new subsystem) tiers are now
**done** — see "Landed" below.  What remains is split into **needs a
call** (a new selector type, storage, lifecycle, or readback path) and
**deferred** (already-declared out-of-scope blocks, for completeness).

### Landed (LHF + small-touch)

Done across 11 isolated commits, each with Node tests (interaction-gated
behaviour also covered by Playwright).

Core:
- Viewport math/setters: `reset`, `viewport({zoom,pan})`, `minZoom(v)`/
  `maxZoom(v)`/`zoomRange` setters, `getFitViewport`/`getCenterPan`
  (compute without committing), `renderedExtent`, `size`, `centre`.
  (`getZoomedViewport` skipped — internal in v3.)
- Introspection/aliases: `instanceString`, `isReady` (via a
  `_readyResolved` flag), `headless`, `styleEnabled`,
  `hasCompoundNodes`, `hasElementWithId`, `$id`, `mutableElements`,
  `window`, `options`.
- Events: `once`, `listen`/`bind`, `unlisten`/`unbind`, `pon`;
  `onRender`/`offRender`.
- `renderer()`, `forceRender()` (renderer got a public `requestRender`),
  `resize()`/`invalidateSize`, `makeLayout`/`createLayout`.
- Graph-level `data`/`removeData`/`scratch`/`removeScratch` (+`attr`/
  `removeAttr`), plain objects on the core.
- Interaction gating: `autolock`/`autoungrabify`/`autounselectify`
  (+`*Nodes` aliases) and `panningEnabled`/`userPanningEnabled`/
  `zoomingEnabled`/`userZoomingEnabled`/`boxSelectionEnabled`; all ctor
  options too.  `pan`/`panBy`/`zoom` gate on the programmatic flags; the
  pointer gates drag-pan/wheel/pinch on the `user*` flags and drag on
  grabbable+unlocked; `autounselectify` suppresses tap selection.

Collection:
- Reference/identity: `cy()` (was absent), `renderer()`, `element()`,
  `collection()`, `instanceString`, `hasElementWithId`, `indexOf`/
  `indexOfId`.
- Traversal (existing CSR adjacency): `roots`, `leaves`, `successors`,
  `predecessors`, `edgesWith`, `edgesTo`, `parallelEdges`,
  `codirectedEdges`, `components`/`component`/`componentsOf`,
  `allAreNeighbors`.
- Set/iter/degree: `byGroup`, `absoluteComplement` (+`complement`/
  `abscomp`), `diff`, `reduce`, `max`/`min` ({value,ele}), `sort`,
  `merge`/`unmerge`/`relativeComplement` aliases, `isLoop`/`isSimple`,
  `equal`/`equals`, `min/maxDegree`/`min/max{In,Out}degree`/
  `totalDegree`.  `degree`/`indegree`/`outdegree` are **singular**
  first-element accessors (undefined when the first element isn't a live
  node), as in v3 — the whole-collection sum is `totalDegree`.
- Dimensions: `renderedBoundingBox`, `renderedWidth`/`renderedHeight`
  (+outer), `renderedPosition` setter, `shift`/`silentShift`,
  `silentPosition(s)`, `midpoint`/`renderedMidpoint`, `source`/
  `targetEndpoint` (+rendered; node-center approx), `relativePosition`,
  `point`/`modelPosition` aliases.
- Data/scratch/json: `removeData` (+`attr`/`removeAttr`), per-element
  `scratch`/`removeScratch` (plain JS on the interned handle),
  `json`/`jsons`; `once`/`pon`/`listen`/`bind`/`unlisten`/`unbind`.
- Flags: `selectify`/`unselectify`, `grabbable`/`grabify`/`ungrabify`,
  `locked`/`lock`/`unlock`, `grabbed` getter, `show`/`hide`/`visible`/
  `hidden`.  `FLAG_GRABBABLE`/`FLAG_LOCKED` added; grabbable defaults on;
  def/ctor-level `grabbable`/`locked`.  `show`/`hide` turned out to be
  pure LHF — the cull kernels and CPU pick already mask on
  `SHOWN = ALIVE|VISIBLE`, so toggling `FLAG_VISIBLE` needed no shader
  change.
- `move()` for edges (re-endpoint in place via `store.moveEdge`).

Not yet ported from the small list: ~~`active`/`activate`,
`pannable`/`panify`, `inactive`~~ — landed in round 6 (below).

### Collection/core API performance

Benchmarked against the v3 analogue in `src/` via Mitata
(`npm run benchmark:gpu`, `BENCH_N` scales the graph; suites in
`benchmark/gpu/`).  The harness rotates over a pool of distinct operands
so V8 can't hoist pure loop-invariant calls out of the measured region —
without that, allocation-free ops (e.g. `same()`) mis-report by 5 orders of
magnitude.  On a 2k-node/4k-edge graph:

- **Where v4 wins big**: `degree`/`totalDegree`/`maxDegree` ~100–230× (O(1)
  off the adjacency index vs v3 rebuilding `connectedEdges`); `add`+`remove`
  ~32×; `components` ~30×; `intersection`/`difference` ~24×; `collection()`
  ~14×; mutations (`data`/`position` set) ~10–12×; `map` ~2.6×; traversal
  1.5–4×.
- **Optimizations applied** (each its own commit, all revealed by the
  benchmark): pure `#id` selectors resolve through the O(1) id index instead
  of materializing + scanning the graph (`$('#id')` went ~420× slower →
  ~3× faster than v3); set membership keys on a packed `{group, slot, gen}`
  integer instead of a `group:slot:gen` string; each collection lazily
  caches its membership `Set` (sound — `_refs` is immutable), so
  `same`/`contains`/set ops are O(other) once a collection is reused
  (`contains` ~13× slower → ~4× faster); subset results
  (`filter`/`nodes`/`edges`/`slice`/`difference`/`intersection`) spawn via a
  dedupe-skipping `_spawnUnique`; `map`/`forEach`/`filter` preallocate and
  hoist the `thisArg` branch; `position()` reads its column once.
- **Columnar flag-selector scan (perf round 3)** — closed the residual
  whole-graph losses without copying v3's maintained-set approach.  The
  mini-selector language minus `#id` (which keeps its id-index path) is
  entirely (group, flag-mask) predicates, so `compileFlagPlan` compiles any
  flag-only selector to per-group `(mask, want)` tests and
  `GraphStore.scanRefsInto` answers them with one preallocated pass over
  the flags column — no handles, no per-element term matching; today's
  pseudos always collapse to one test per group (a multi-flag language
  would generalize to a test list).  `cy.elements/nodes/edges/filter/$`
  route through it (`_select`: id index → flag scan → materialize+match
  fallback for mixed id+flag comma lists), collection `filter(selector)`
  tests refs against the plan directly, the interned-handle pool went
  `Map` → dense slot-indexed array, and scan-built collections skip
  `_eleFromRef` (refs known current).  Callback iteration
  (`forEach`/`map`/`filter(fn)`/`some`/`every`/min/max) now plain-calls
  when no `thisArg` is given, matching v3's semantics (`this` is
  undefined, not the element) — rebinding the receiver per element via
  `fn.call()` cost ~2× at 20k.  Verified at N = 2k/20k/200k (the focused
  `benchmark/gpu/materializers.mjs` sweep runs where the full suite
  can't): `$(':selected')` ~2× slower → 16–59× faster, `$('node')` →
  9–14×, `$('node:selected')` → 46–166×, `nodes(':selected')` → 70–198×,
  `nodes()`/`edges()` → 3–9×, `elements()` ~2.6× slower → ~parity-to-2×
  faster, `filter(fn)` flipped to a win, `forEach` ~3.3× slower → ~1.8×.
- **Columnar bulk writes (perf round 4)** — the write-side counterpart of
  round 3, driven by a new `benchmark/gpu/mutators.mjs` sweep (whole-graph
  mutation round-trips vs v3 at 2k/20k/200k; `BENCH_OP` runs one group per
  process at 200k, where eight v3 instances exceed the heap).  The sweep
  exposed `eles.select()` as the one outright loss: per-element
  `_applyStyle` (a defaults-spread + full block match per element) and an
  unconditional per-element emit made 200k-node select+unselect 178 ms —
  behind v3 at 2k and only ~1.4× ahead at 200k.  Fixes, each revealed by a
  benchmark line: (a) `GraphStore.flagRefs` — one bulk flag pass over a
  collection's refs with the flags/gen columns hoisted out of the loop, a
  `requireBit` filter (selectable-only for selection), changed-index
  collection and one coalesced dirty span per group — now backs
  select/unselect *and* all `_setBit` mutators (`show/hide`, `lock`,
  `grabify`, `selectify`); (b) select/unselect skips restyle outright
  unless some block matches on `:selected/:unselected`
  (`StyleEngine.dependsOnSelection`; the accent ring is shader-drawn, so
  the default stylesheet never restyles), else restyles only the changed
  slots via `applyBulk`; emits are gated on registered listeners;
  (c) `shift()` and constant/partial `positions()` write the position
  column directly (`GraphStore.shiftPositions`/`setPositionsConst` — no
  per-element handles, callbacks or Position allocations) and the
  `positions(fn)` path reads previous coords off the column instead of
  allocating via `position()`.  At 200k vs v3: select+unselect 178 → 6.2 ms
  (1.4× → 38×), hide+show 2.4 ms (~1400×; v3 pays a style bypass per
  element), lock 96×, positions(obj) 71×, positions(fn) 44×, shift
  18.8 → 2.6 ms (106×), remove+re-add of a 256-node band ~1000×.  The gpu
  side improved 3–54× per op at 2k (select 54×, shift 5×, lock 8×,
  hide 6×); `data set` is dominated by per-(group,key) column resolution
  and stayed ~1× (16–22× over v3; its 200k timing is GC-noisy on both
  sides).
- **Slot-native traversal (round 4b)** — traversal walks built results by
  pushing refs per adjacency hit and re-deduping in `_spawn` (a
  packRef-keyed Set over ref objects), iterated CSR runs through the
  iterator protocol, and `successors/predecessors` spawned a full
  collection per hop — ~10.5 s for one 20k-node closure on the benchmark
  ring (diameter ~N/3; v3 ~40 s).  Now every walk (`connectedEdges`/
  `connectedNodes`, `outgoers`/`incomers`, `neighborhood`,
  `roots`/`leaves`, `sources`/`targets`, `successors`/`predecessors`)
  collects current refs straight off CSR with an int-packed (group, slot)
  seen-set and index loops, and spawns through `_spawnLive` — a trusted
  `{unique, live}` constructor path that skips per-element
  `_eleFromRef` re-validation.  `neighborhood` pre-seeds the seen-set
  with its own elements instead of a `difference()` post-pass, and
  `successors/predecessors` is a raw slot BFS (no per-hop collections at
  all): 2k-node closure 92.7 ms → 352 µs (2.9× → ~725× vs v3).  Verified
  by `benchmark/gpu/traversal.mjs` at 2k/20k: the two residual v3 wins
  flipped (100-node-band `connectedEdges` 1.2–1.5× loss → 1.3–1.5× win,
  band `sources` 1.1–1.3× loss → 1.3× win), and the rest widened —
  `neighborhood` 2× → ~4×, `outgoers`/`incomers` ~3.4× → ~4.5×, band
  `neighborhood` 2.5× → ~5.4×, band `roots` ~64× → ~110×.  The ~2–5×
  ceiling on single-hop traversal is structural, not unfinished work: v3
  is already O(degree) there (each element object holds its incident
  edges as a direct array), and a traversal must *return* a v3-shaped
  collection — per output element the gpu side allocates a ref, dedupes
  and interns a handle, a floor comparable to v3 assembling its result
  from already-materialized objects.  Bulk writes have no such floor
  (they touch columns and return nothing), which is why `shift` can be
  ~106× while `outgoers` is ~4.7×; the big traversal multipliers only
  appear where an *algorithmic* layer was removed (the per-hop collection
  machinery in `successors`).
- **Scenario sweep (round 5)** — with the micro surface swept, the open
  question was whether the wins survive *composition* and the
  listener-gated emit paths the micro suites deliberately exclude (their
  emits never fire — no listeners are registered).
  `benchmark/gpu/scenarios.mjs` replays five composed traces with core
  listeners attached, at 2k/20k/200k (`BENCH_OP` one-group-per-process at
  200k; v3 instances styleEnabled + preset layout — the realistic app
  config, and required for meaningful v3 bounds headless).  Results (× vs
  v3): explore (2-hop expand + select + fit) 8.4/5.3/34×; select-all +
  whole-graph fit with 2N emits per iter 18/10/12.6×; 100-band drag with
  a position listener (800 emits/iter) 8.5/7.3/10.6×; remove + re-add
  256 + cascade with add/remove listeners 20/162/529×; dashboard refresh
  (bulk data write + mapped labels + filter(fn) + fit, data listener)
  3.8/4.0/4.2× before the fix below, 9.5/6.4× at 20k/200k after.  Emit
  cost itself is ~85 ns/listener call (~17 ms for 200k emits) — no
  batching policy is urgently needed.  Two fixes fell out: (a) `pan()`
  get returned a fresh `{x,y}` per call — now returns the live internal
  object (v3 parity; setters always swap in a new object), ~4× slower →
  ~2.3× faster; (b) the refresh trace exposed the **data-write label
  path**: `_onDataChanged` ran a *full* per-element style apply (defaults
  spread, every block matched, all six node channels + dirty spans
  rewritten) per element per write whenever any label mapped any data
  key — 64 ms of an 85 ms 200k bulk write.  Now the StyleEngine tracks
  which keys labels map (`labelDependsOn(keys)`, decided once per
  `_setData` call), and `refreshLabels(slots)` recomputes only the label
  sidecar, resolving the stylesheet once per selectedness like
  `applyBulk` (per-element fallback only under `#id` blocks); writes of
  unmapped keys skip the pass outright.  200k bulk write with
  mapper+listener: 85 → 37 ms.
- **Residual v3 wins** (micro-ops at 20k, accepted): `forEach` (~1.8×),
  `getElementById` (~1.4×), `data()`/`position()` get (~1.1×,
  noise-level).

### Landed (round 6 — the needs-a-call tier)

Five isolated commits (2026-07-24), each with Node tests; box selection
also has a Playwright spec (18 webgpu specs total, all green on a real
adapter).  `src/gpu/README.md` records the policies.

- **`active`/`pannable` states**: `FLAG_ACTIVE`/`FLAG_PANNABLE` bits;
  `activate`/`unactivate`/`active`/`inactive`, `panify`/`unpanify`/
  `pannable` through the bulk flag path.  v3 defaults (edges pannable,
  nodes not; per-def override); pannable overrides `grabbable()` and
  drag eligibility, so dragging a pannable element pans.
- **Batching** (`startBatch`/`endBatch`/`batch`/`batchData`/
  `batching`): v3 semantics — defers style application (first apply of
  added elements, sheet re-application, mapped-label refresh) to one
  bulk flush at the outermost `endBatch`, filtered to live refs; events
  keep firing; a sheet set mid-batch flushes as one `applyAll`.
  Renderer scheduling needed no deferral (the dirty tracker already
  coalesces per microtask), so `notify`/`noNotifications` have no v4
  counterpart.
- **Read-only style getters**: `style`/`css`, `renderedStyle`
  (length props × zoom), `numericStyle`, `effectiveOpacity`/
  `transparent`/`takesUpSpace`/`interactive`.  Values read back from
  the stored channels (columns + label sidecar); label channels of
  unlabelled nodes resolve through the sheet.  Setter forms throw — no
  per-element bypass in v4 (mappers are the per-element mechanism).
- **Core `json()` export**: elements (grouped, or flat via
  `json(true)`), sheet, graph data, viewport, gating flags; element
  json gained `locked`/raw `grabbable`/`pannable` (v3 parity).  The
  import/restore form throws (needs stored defs); exported elements
  round-trip through the definition form.
- **`selectionType` + box selection**: validated
  `'single'`/`'additive'` (ctor option; additive taps toggle without
  clearing, mult-sel keys shift/ctrl/cmd match v3);
  `GraphStore.refsInBox` answers the box query in one columnar scan
  over shown elements (v3 'contain': node bb incl. border fully
  inside, straight edges by both endpoint centers), public as
  `cy.elementsInBox`; the pointer boxes on mult-sel-key drags (or when
  panning is disabled) with a DOM overlay box and the v3 event flow
  (`boxstart`/`boxend`, `box`/`boxselect` per element).  Mouse/pen
  only.

### Needs a call — note only, don't build yet

- **Classes** (`classes`/`addClass`/`removeClass`/`toggleClass`/
  `hasClass`/`flashClass`): new per-element class storage + class
  selectors in the mini-selector + restyle on change.  Couples to the
  constrained (constants-only) style engine.  **Call made: not in v4** —
  see "Selector removal + stylesheet reshape" below.
- ~~**Style getters**~~ — the read-only surface landed in round 6
  (shape call: stored-channel truth, numbers + `rgb()` strings);
  `bypass`/per-element style *setters* remain out by design (the fn
  mapper is the per-element mechanism; `pstyle` stays internal-only in
  v3 and has no v4 counterpart).
- ~~**Batching**~~ — landed in round 6 with the v3 policy (defer style
  apply, keep events); `notify`/`noNotifications` deliberately have no
  v4 counterpart (the renderer is dirty-driven).
- ~~**Core `json()` *import*** and element `clone`/`copy`/`restore`~~ —
  **call made (round 10 planning, 2026-07-27): not in v4.**  Removed
  elements are terminally dead (see the design decision in
  `src/gpu/README.md`): their column bytes are tombstoned and the slot
  free-listed, so nothing keeps a removed element readable or
  restorable.  `restore()`/`clone()` and the import form of `cy.json()`
  are permanently closed; re-adding from kept definitions is the app's
  job (exported element json round-trips through `cy.add()`).
- ~~**Image export** (`png`/`jpg`/`jpeg`/`renderTo`)~~ — landed in round
  9.6 (below) as the offscreen render + buffer readback path;
  `renderTo` remains out.
- **`mount`/`unmount`**: the container is fixed at construction today;
  re-mounting means renderer teardown/re-init.
- **Lazy / slot-backed collections**: the only way past traversal's ~2–5×
  handle-materialization floor (see round 4b) is returning collections
  that hold slot lists and intern handles on demand — an API-shape change
  (it moves the cost of `eles[i]`/`forEach` from build time to access
  time, and complicates the "handles are interned singletons" invariant).
  **Call made (round 5): not warranted.**  The scenario sweep measured
  the floor in composed traces: in the worst one (dashboard refresh, the
  narrowest win) the per-element handle reads in `filter(fn)` cost
  5.2 ms of a ~90 ms iteration at 200k (vs 1.9 ms for a direct columnar
  scan) — ~4–6% of the trace — and the traversal-heavy explore trace runs
  a 200k click-interaction in ~45 µs median, 34× v3.  Revisit only if a
  real profile ever disagrees.
- Odds and ends that each need a small feature, not just wiring
  (~~`selectionType` + box selection, `active`/`activate`, `pannable`/
  `panify`~~ — landed in round 6): `multiClickDebounceTime`
  (multi-click), `eles.layout()`/`layoutPositions`/`layoutDimensions`,
  `boundingBoxAt` (bbox at a hypothetical position),
  ~~`sortByZIndex`/`zDepth`~~ (closed 2026-08-01: z-index is dropped
  by decided design — see the design-sitting section below),
  `padding`/`paddedWidth`/`paddedHeight`.

## Selector removal + stylesheet reshape (v4 API direction)

Decided in design discussion (2026-07-24) and implemented in one pass;
`src/gpu/README.md` ("Design decisions") is the maintained record.  The
decisions, explicitly:

- **v4 has no classes.**  The class system (`addClass`/class selectors)
  is not coming to v4; user-defined state lives in the columnar `data()`
  sidecar, with mappers and predicates supplying the styling/filtering
  behaviour classes provided in v3.
- **v4 has no selector strings at all.**  Rather than porting a dialect
  of the v3 selector language, the language is gone: `selector.mts` was
  deleted and replaced by `matcher.mts` — a **matcher IR** of structured
  queries (`{ group, selected }` today) compiled to the round-3 columnar
  flag scans.  Query objects answer whole-graph queries
  (`cy.nodes({ selected: true })`, throwing on unknown keys), predicate
  functions cover everything richer (lodash-style), including event
  delegation (`cy.on('tap', ele => ele.isNode(), cb)`, identity-compared
  in `off()`), and ids go through `$id`/`getElementById`.  `cy.$()` and
  string arguments to set ops/`edgesWith`/`components`/`remove`/`fit`
  were removed.  Future richer matching (data predicates, structural
  terms) extends the IR; any frontend (chained builder, serialized
  query) compiles to it.
- **Style is `{ nodes, edges }`** (keys renamed from `{ node, edge }`
  2026-07-24 to match the group names) — each key a props object
  (constants, camelCase or kebab-case, and mapper objects).  Selector
  blocks, `:selected` restyling and `#id` blocks are gone (the accent
  ring is shader-drawn).  The `(ele) => props` **function form was
  removed in round 8** (below): all per-element styling is declarative
  (`case` conditionals, `data(key)` scales), so every value is
  analyzable, serializable, and GPU-evaluable.  Refresh: a data write
  re-derives the affected mapped channels, key-gated.
- ~~**Mapper DSL direction**~~ — landed in round 7 (below), as a plain
  object spec rather than strings/builder; round 8 added conditionals
  and removed the fn form.

Verification: typecheck, lint, `test:js` (1221 passing, incl. the new
`gpu-query.mjs` matcher suite and rewritten style/events/flag-scan
suites), and all 17 Playwright webgpu specs on a real adapter.
Benchmarks compare idiomatic forms per side now (`cmp(name, v3Op,
gpuOp)` where they differ); `pointer.mts` tap-clear uses
`elements({ selected: true })`.

## Landed (round 7 — the mapper DSL, 2026-07-24)

Ten isolated commits (after a `{ nodes, edges }` sheet-key rename to
match the group names): OKLab + scheme tables → mapper compile/IR →
engine integration → data-write plumbing → program packing → GPU eval
(scalars, then colors) → ordinal dict path + mixed demotion → benchmark
→ docs.  All green throughout: typecheck, lint, `test:js` (1360 tests;
three new mapper suites), `test:modules`, 20 Playwright webgpu specs on
a real adapter.  `src/gpu/README.md` ("Design decisions") is the
maintained record; the shape, briefly:

- **Spec**: plain serializable objects as style prop values —
  `{ data, scale?, domain?, range?, clamp?, fallback?, ... }`.  Scales:
  linear/log/sqrt/pow/symlog, diverging ([min, mid, max]), ordinal,
  threshold, quantize.  Colors interpolate in OKLab (opt-out
  `interpolate: 'srgb'`) with named schemes (viridis family, ColorBrewer
  ramps, category10/dark2) and multi-stop ranges.  Missing/unmappable
  data → `fallback` else the channel default.  `domain` omitted/'auto'
  is a **live extent** (Vega-Lite semantics): re-checked on writes of
  the mapped key, whole-channel re-derive when moved.  Compiles to a
  closure-free IR (`style-scales.mts`): everything continuous lowers to
  one piecewise program over transformed stops; refresh is gated per
  (group, key); edge data writes now refresh edge channels; fn-sheet
  returns may not contain mappers; `label` takes the passthrough only.
- **GPU eval — the paint/geometry split**: paint channels (fill/border/
  line colors, opacities, arrow colors) evaluate in a per-group compute
  kernel that interprets a packed program array (64 B uniform structs +
  vec4 stop/LUT tables + f32 data-region shadows with present masks)
  and writes the *existing* channel buffers — render pipelines
  untouched, zero permutations, fits base device limits.  Data writes
  upload only the touched bytes and dispatch once (200k color write:
  78.5 → 15.9 ms; the getter answers by evaluating the shared IR
  lazily, within ±1/byte of pixels — Playwright-pinned).  Geometry
  (size, border-width, shape, edge width) + labels stay eagerly
  CPU-evaluated: anything read by culling, CPU picking, or columnar
  scans stays CPU-canonical.  Arrow alpha folds in-kernel; mapped arrow
  *shapes* and mixed-promoted columns demote to CPU; string ordinals
  run as dict-index LUTs (dict growth repacks); headless stays fully
  CPU-correct with no renderer.

## Landed (round 8 — conditionals + fn removal, 2026-07-24)

Direction set in discussion: maximize GPU offload / minimize CPU resolve
by making the analyzable mapper IR the *only* way to style, and removing
the one construct that can never be offloaded — the opaque style
function.  Isolated commits; all green (typecheck, lint, `test:js`,
`test:modules`, 20 Playwright webgpu specs).

- **CPU-evaluable invariant (established).**  Every mapper must be cheaply
  CPU-evaluable.  That is what keeps `ele.style()` synchronous, keeps
  headless mode and Node tests working (one IR runs on CPU, GPU, and in
  tests), and keeps determinism.  Reads stay **sync** — async reads were
  considered and rejected (viral, reentrancy windows, breaks
  headless/testability, and unnecessary while the IR is CPU-evaluable).
  GPU eval is an optimization over the IR, never a value source the CPU
  can't reproduce.  Async is reserved for genuinely GPU-only reads
  (rendered pixels, image export).
- **`case` conditional mapper.**  `{ case: [{ when: { data,
  gt/lt/eq/ne/in/... }, then }], else }` — ordered clauses, conditions
  AND-ed within a clause, first match wins; `when` reads any data key or
  the first-class `id`.  The declarative replacement for `(ele) => cond ?
  a : b` and the form for typed edges.  Compiles to a closure-free
  program; CPU-evaluated (multi-key), so the GPU eval kernel is
  untouched.  Dependency tracking generalized to `CompiledMapper.keys`.
- **The `(ele) => props` fn form removed.**  `GpuStyleFn` is gone; the
  sheet is props-only.  The engine collapsed to one path (no `def.fn`
  branches in applyBulk/refreshMapped/labelChannels/setSheet, no
  fn-return throw, `eleFor` dropped).  Selection-dependent recolouring
  is intentionally gone (the accent ring is shader-drawn); id-based
  styling migrates to `case` on `data: 'id'`.  Tests/docs migrated.
- **Deferred:** derived-data *expression* mappers (arithmetic over keys —
  no current use needs them); and geometry channels → GPU eval (the
  direct ~48 ms/200k offload, but it inverts the store→style layering
  since `boundingBox`/`refsInBox`/CPU-pick read resolved size — a later
  round).

## Landed (round 9 — animation, 2026-07-24)

Direction (discussion): animation is a v4 priority and should scale.  API
first, on the CPU-canonical path (complete + correct + Node-testable); a
GPU tween fast path is the planned optimization underneath, transparent to
the API.

- **Animation API + CPU tweening** (`src/gpu/animation.mts`).  Tween
  element style/position (and the viewport) from captured start values to
  explicit targets over a duration, easing normalized time.  Collection:
  `animate`/`animation`/`animated`/`stop`/`delay`/`delayAnimation` +
  `promise()` + a per-element queue (the queue since removed — round
  21 runs animations concurrently by channel); core: `animate` (viewport pan/zoom),
  `animated`, `stop`.  Each tick writes the store columns (works headless;
  a rAF-or-timeout auto-driver, plus a deterministic `tick(now)` for
  tests).  Standard easings.  Animatable: `position`, node `opacity`,
  `border-width`, `background/border/line-color` — the coupling-free set;
  size (width/height circle-collapse) and arrow-folded channels are a
  follow-up (both since landed — the arrow fold in round 9.4, the
  geometry channels in round 25).
- **Ownership: transient lease** (design set this round).  A tween is
  CPU-reproducible (pure fn of time), so the CPU columns stay
  authoritative on the CPU path.  The lease model — default
  CPU-authoritative, GPU-authoritative during a position episode with
  readback-on-settle — is the shared substrate for the GPU tween path and
  (later) GPU layouts.  **Grabbing is forbidden while an element
  animates** (`pointer.canDrag` consults `isAnimating`), removing the
  two-way drag-feedback boundary.
- **GPU position fast path** (`render/gpu-tween.mts`, landed).  Position
  animations offload to a compute pass: per-slot from/to uploaded once, a
  `now` uniform bumped per frame, `node.position = mix(from, to, ease(t))`
  on-device in its own pre-cull pass (barrier → cull + edges read the
  tweened positions).  `node.position` is GPU-owned during the tween (the
  mirror skips its uploads), CPU reads stale, settle-on-complete
  re-derives the exact final on the CPU (no readback — tween is
  CPU-reproducible).  The renderer drives the frame clock while active;
  the manager routes position-only animations to the sink and cedes its
  auto-loop.  Playwright proves the lease on a real adapter (CPU
  `position()` stays at start mid-flight while the node moves; settles
  after).  Paint/size GPU tweens are a follow-up.
- **Deferred:** GPU tween for paint/size channels; and **GPU layouts**
  (stateful, not CPU-reproducible → GPU-authoritative-with-readback + a
  CPU reference for headless) — reuse the lease machinery; per-algorithm
  kernels are a future round.

## Design discussion (2026-07-24) — GPU geometry & the read-staleness contract

Direction set in discussion after round 9, ahead of building the paint/size
GPU tween extension.  No code yet; these are the locked calls that scope that
work and the expensive-geometry cases (multiline labels, bundled bezier) that
sit behind it.  `src/gpu/README.md` ("Design decisions") is the maintained
record.

- **Paint tween is the clean next extension; size is a geometry-tier
  project.**  The `gpu-tween.mts` runtime generalizes to paint channels
  (`node.opacity`, fill/border/line color, `edge.opacity`) with low risk —
  paint has **no CPU consumer** (cull, CPU pick and columnar scans never read
  it, which is why it went GPU-evaluable in the mapper split), so a paint
  tween owns its column with no staleness hazard.  Work: widen `fromTo` for
  color (two `vec4f` per slot; sRGB per-channel to match the current CPU
  tween unless we deliberately unify on OKLab), fold `edge.opacity` into
  arrow alpha in-kernel, and an ownership-precedence rule so an active tween
  wins over the mapper eval kernel writing the same channel.  **Size**
  (`width`/`height`/`border-width`, `edge.width`) is *not* a peer: it is
  geometry read by cull, CPU pick, and every columnar scan, so a GPU-owned
  size tween reopens the store→style layering seam R8.5 flagged and belongs
  with that geometry work.  Recommendation: ship paint-only (an R9.4), bundle
  size with the R8.5 geometry-seam work.

- **The read-staleness contract.**  A frame-stale sync-read contract (GPU
  owns expensive geometry, CPU reads a frame behind) was floated and
  **rejected as a default**, for three reasons: (1) read-after-write is
  pervasive and load-bearing — `data()`/`position()` then `width()`/`bb()`
  in one synchronous tick must reflect the write (layouts, extensions, user
  code all rely on it); (2) headless has no frame and no readback, so it
  would still need the complete CPU implementation *plus* a weaker contract —
  strictly worse than CPU-canonical; (3) "a frame stale" is undefined in
  synchronous code (a build-graph → query-bbs loop never yields to a frame,
  so staleness is unbounded, not one frame; real GPU→CPU latency is 1–3
  frames regardless).  Staleness is admitted **only for values already in
  frame-driven motion** — the position tween lease is exactly that, and
  `edge.bb()` mid-tween inheriting it is consistent, not a new rule.  A
  discrete user write is never stale.  Escape hatch for GPU-exact geometry
  after a write batch: an explicit `await` on a settle/flush, not a relaxed
  sync default.

- **Expensive GPU geometry → dual implementations, not readback** (multiline
  labels, bundled bezier — v4-but-not-yet; since superseded for bundled
  bezier + self-loops, which landed round 12a under exactly this model).  These are expensive *and* read
  by `.bb()`, so the position lease's no-readback trick doesn't apply
  directly (they aren't cheaply CPU-reproducible).  The model: **two
  deterministic implementations that agree by construction** — WGSL for
  render, CPU for reads, run on the same inputs, neither reading back the
  other — the OKLab-LUT/mapper-table discipline generalized to expensive
  computations.  The standing cost is keeping the two impls bit-agreeable
  (divergence = bb-doesn't-match-pixels), which is the actual gate on whether
  GPU is worth it per case.  Two consumer tiers keep it affordable: **cull/
  fit read a cheap conservative CPU over-approximation** (guaranteed to
  contain the true box), **public `.bb()` triggers the exact lazy CPU
  compute, memoized per element**.  For bezier: control points are
  `f(positions, membership)` — stale via the position lease mid-tween
  (consistent), settle when positions are reclaimed; bundle *membership* is a
  cheap CPU structural index rebuilt on add/remove edge, not per frame.

- **Labels are model-space only** (no viewport-fixed mode).  `font-size` and
  the wrap width are both model coordinates (v3 parity).  Load-bearing three
  ways: (1) line breaking is zoom-invariant (font-size and wrap width share a
  space), so shaping — the expensive part — **memoizes** and the GPU metrics
  pass runs on text/font/wrap writes, not per frame (a *mixed* space reflows
  on zoom and defeats both memo and offload); (2) **image export is WYSIWYG**
  — a `full`/high-`scale` export is the screen arrangement over identical
  shaping, so scientific figures don't reflow between screen and export and
  the export reuses the screen memo; (3) v3 parity, so existing figures
  reproduce.  Screen-space labels were rejected: they break export WYSIWYG
  (reflow at a scale ≠ current zoom) and their apparent legibility win on
  dense graphs is overlap that makes a worse figure (a data-density limit,
  answered editorially, not by a coordinate system).  The visibility
  sub-decision was taken in round 9.6: label LOD thresholds evaluate at
  **export scale** (self-consistent figure), as leaned.

### Deferred by design (out of scope for the prototype)

- ~~**Compounds**~~: `parent`/`parents`/`children`/`descendants`/
  `commonAncestors`/`siblings`/`orphans`/`nonorphans`/`isParent`/
  `isChild`/`isChildless`/`isOrphan`, and compound-relative
  `relativePosition`/`padding`/bounds — **landed in round 14**.
- ~~**Animations**~~ — landed in round 9 (CPU-canonical path; below).
- **Graph algorithms** (`src/collection/algorithms/*`): bfs/dfs,
  dijkstra, aStar, kruskal, bellmanFord, floydWarshall, pageRank, all
  centralities (degree/closeness/betweenness), all clustering
  (markov/k-means/k-medoids/fuzzy-c-means/hierarchical/affinity), tarjan
  & hopcroft-tarjan, hierholzer, kargerStein.
- **Bezier/segment geometry**: `controlPoints`/`segmentPoints`/
  `isBundledBezier` and curved edge rendering — a v4 direction, in the
  expensive-geometry tier (see the design discussion above): dual CPU/WGSL
  impls, conservative CPU bound for cull/fit, exact lazy CPU `.bb()`,
  membership as a structural index.  (Since superseded: bundled bezier +
  self-loops landed round 12a exactly in this tier, incl.
  `controlPoints`/`isBundledBezier`; `segmentPoints` and the
  unbundled/segments/taxi families landed in pass 12b, same tier.)
- **Full stylesheet + mappers** beyond the constant blocks and the label
  `data(key)` mapper; layouts beyond grid/preset.  (Since superseded:
  mappers landed round 7–8; circle/concentric/breadthfirst/random
  layouts landed round 10.)

## Landed (round 9.4 — GPU paint tweens, 2026-07-27)

Executes the paint half of the round-9 follow-up under the design calls above.
The scope correction made while planning it: `border-width` was listed with the
paint channels in round 9, but it is **geometry** — `boundingBox()` reads
position ± size/2 + border/2 — so it stays CPU-canonical and moves to the R8.5
geometry-seam work.

- **Paint/geometry tiers** (`animation.mts`).  Channels carry a `tier`:
  *paint* (`opacity` both groups, `background-color`, `border-color`,
  `line-color`) may offload, *geometry* (`border-width`, and later size /
  `edge.width`) may not.  Paint has **no CPU consumer** — nothing in cull, CPU
  pick, or a columnar scan reads it, which is why it went GPU-evaluable in the
  mapper split — so a tween can own the column outright.  Eligibility is
  all-or-nothing per animation, so a column is never half-owned.
- **One capture, two executors.**  `capture()` snapshots start values into
  per-channel `ChannelWrite`s (column, kind, slots, packed from/to) once; the
  CPU tick and the GPU kernels consume the same numbers, so they agree by
  construction rather than by parallel implementations.
- **Three kernels** (`render/gpu-tween.mts`): `position` (vec2), `scalar`
  (f32), `color` (packed rgba8).  Dispatch counts come from WGSL
  `arrayLength(&slots)`, not a uniform — `queue.writeBuffer` is ordered against
  submitted command buffers, *not* against dispatches inside one, so a
  per-dispatch value cannot live in a shared uniform (a bug caught while
  authoring; pinned by a test).
- **Tween-wins precedence, free mapper reclaim.**  Paint dispatches are encoded
  inside the cull pass *after* `mapperRuntime.encode()`; dispatches in one pass
  observe prior dispatches' writes (the guarantee the cull kernels already rely
  on), so a live tween beats the eval kernel for the same channel.  On settle,
  the CPU write dirties the column — already the mapper's re-evaluation
  trigger — so the mapped value returns with no new machinery.
- **Colors tween in OKLab**, matching color mappers' default: one perceptual
  model across the library instead of a mapper/animation split.  Endpoints are
  converted on the CPU and packed as two `vec4f` (L, a, b, alpha), so the
  kernel needs only the OKLab→sRGB direction it shares with the mapper kernel.
  **Deliberate v3 divergence** (v3 tweened per-channel in sRGB) and a change to
  round 9's shipped CPU behaviour.
- **Arrow-alpha fold rides along.**  The arrow VS is at WebGPU's base
  8-storage-buffer limit, so edge opacity is pre-folded into stored arrow alpha
  (`stored.a = base.a × opacity`).  The fold is linear in opacity, so animating
  `edge.opacity` also emits a color tween per arrow end to `base × toOpacity` —
  identical math on both executors.  The base comes from
  `StyleEngine.arrowBase()`, not the stored bytes, which cannot recover it when
  the folded opacity was 0.
- **Bugs fixed on the way in** (all pre-existing, all now covered):
  `eles.animate({style: {opacity}})` was a silent no-op on **edges** (the
  channel map was node-only); `stop()` on a GPU-driven animation left the CPU
  at the start value while the device buffers held the last frame drawn, with
  nothing to reconcile them (it now settles, matching v3's leave-it-where-it-got
  -to); a custom easing **function** was silently downgraded to `'ease'` on the
  GPU (made ineligible here, then dropped from the API in R9.5); and the GPU
  path captured start values *before* the delay elapsed,
  unlike the CPU path.
- **A reserved-word trap, and the guard for it.**  `target` is a WGSL reserved
  keyword: all three tween pipelines failed to compile, the dispatches became
  silent no-ops, and the specs still passed on stale buffer contents.  Two
  guards now close that hole — the webgpu Playwright project fails any test
  whose console reports a WGSL/validation error, and a Node test
  (`test/modules/gpu-wgsl-identifiers.mjs`) checks every shader's declared
  identifiers against the reserved list, so a GPU-less CI catches it too.
- **Verification**: 1411 Node tests + 47 module tests, typecheck and lint
  clean, and 24/24 webgpu Playwright specs on a real (SwiftShader) adapter —
  including a paint-lease spec (pixels fade through the OKLab path mid-flight
  while CPU `style()` reads the start value; settles exactly on the target) and
  a precedence spec (a tween outranks a mapped `opacity`, which reclaims the
  channel on stop).
- **Still deferred:** the *size* tween (`width`/`height`, `border-width`,
  `edge.width`) with the R8.5 geometry seam, and GPU layouts.

## Landed (round 9.5 — the easing layer, 2026-07-27)

Round 9 shipped eight ad-hoc easings, with the four names shared with v3 drawn
as *different curves* (max deviation 0.33 for `ease`) and unknown names falling
back to `ease` silently.  This round replaces that with one curve layer
(`src/gpu/easing.mts`) that both executors run.

- **v3's enum, verbatim.**  `linear` plus the 25 named cubic-beziers, using v3's
  own control points, so every named curve is now identical to v3's (pinned by a
  test that samples both implementations across t).  One exact Newton solve
  covers the whole enum *and* `cubic-bezier(x1, y1, x2, y2)`, so there is no
  per-name code — the 8 hand-written curves and their WGSL twins are gone.
- **`linear(...)` progression arrays**, in the full CSS form: bare values,
  explicit `%` stops, two stops on one entry for a flat segment, and the CSS
  fill rules (first stop 0, last 1, runs spread evenly, every stop pulled up to
  the largest one before it, so a decreasing stop reads as a jump).
- **`spring(bounce)` replaces v3's `spring(tension, friction)`** with Apple's
  perceptual parameterization (via kvin.me): mass 1, stiffness (2π/D)², damping
  4π(1 − bounce)/D — which reduces to a damping ratio of exactly `1 − bounce`.
  So one number sets the shape: 0 is critically damped, positive rings,
  negative is overdamped.  **A spring compiles to a progression array on the
  CPU** — the closed-form step response sampled over the whole settling window,
  densely enough that the chord error stays under the residual that counts as
  settled — so the kernel needs no physics and a spring costs exactly what
  `linear()` costs.
- **`duration` is perceptual for springs** (the article's model, and SwiftUI's):
  it sets the pace of the key movement and is held constant as bounce changes,
  so the animation runs on past it while the ringing decays —
  `durationMs = duration × durationScale`, where the scale is the settling
  window measured in perceptual units.
- **One program, two evaluators.**  `compileEasing` returns
  `{kind, bezier, points, durationScale, fn}`; the CPU calls `fn`, and the
  kernel reads kind/bezier out of its params (now 48 bytes) with progression
  arrays on a storage buffer at binding 4 (a shared 8-byte dummy when the curve
  needs none).  The WGSL mirrors the CPU step for step — same 11-sample bracket
  and Newton refinement, same binary-search lerp — so they agree to float
  precision; the ends are exact on both sides and a settle re-derives anyway.
- **No custom easing functions** (a v3 feature, and an API break here).  A
  closure cannot cross to the device, so keeping it would mean a curve that
  silently depends on whether the animation was offloaded; with `cubic-bezier()`
  and `linear()` covering any drawable curve, parity is worth more than the
  escape hatch.  Unknown names now **throw** with the list, rather than
  animating on the wrong curve.
- **Overshoot handling.**  Bouncy curves pass their endpoints: position is let
  through (that is the point), while scalar channels clamp to per-property
  bounds on both executors (`opacity` [0,1], `border-width` ≥ 0), mirroring v3's
  `type.min`/`type.max`; color bytes clamp on pack, with alpha clamped
  explicitly (a `Uint8Array` write would wrap).
- **Verification**: 1448 Node tests (28 new easing specs + 5 overshoot specs) +
  47 module tests, typecheck and lint clean, 26/26 webgpu Playwright on
  SwiftShader — including a spring spec (the node visibly passes the target,
  still animating past its perceptual duration, then settles exactly on it) and
  a steep-bezier spec (`ease-in-expo` has barely moved at 40% of the time),
  which together prove both device evaluators.

## Landed (round 9.6 — image export + the visual regression harness, 2026-07-27)

Direction (discussion): ship image export next as the small design-clean
round, and build a pixel-diff harness on top of it — v3 output as a
**tolerance-based parity check**, v4-vs-v4 **golden diffs** as the standing
regression backbone (v3 can't be a strict baseline: SDF vs canvas-2D AA,
label raster/placement, the shader-drawn accent ring all differ by design).
Two calls made explicitly: goldens are checked into the repo (that is what
makes them a regression tool), and v3 parity renders **live in the same
Playwright run** rather than from checked-in v3 snapshots — same-machine
images sidestep cross-platform font/AA determinism entirely and can't go
stale against the v3 code actually in the repo.

- **`cy.png()`/`cy.jpg()`** (`Renderer.exportImage`): offscreen render at
  the requested viewport (current view, or `store.boundingBox()` with
  `full`) into a transient texture + depth target, culled by a dedicated
  export Frame uniform and export CulledGroups through the same
  `drawScene` sequence as the screen; `copyTextureToBuffer` readback
  (256-byte row alignment stripped), BGRA swizzle + unpremultiply to
  straight-alpha RGBA, canvas-2D encode in the core.  v3's options (`bg`,
  `full`, `scale`, `maxWidth`/`maxHeight` override scale, `quality`,
  `output`); every form resolves through one promise (sync readback is
  impossible on WebGPU); jpg defaults `bg` white; headless rejects;
  dimensions beyond the device texture limit throw (no tiling in pass 1).
- **Frame-coherent by construction**: exports are encoded in the frame
  loop after that frame's scene work (deferred while backpressure keeps
  `needsRedraw` set), so they see exactly what the screen shows — a
  Playwright spec exports mid-position-tween and finds the node at its
  GPU-tweened position while CPU `position()` is lease-stale.  Exports
  always render native (adaptive render scale never applies); label LOD
  thresholds evaluate at **export scale**, taking the sub-decision parked
  with the label design (self-consistent figures).
- **Latent bug fixed on the way in**: the label pipeline cached one bind
  group keyed only on mirror/glyph versions — sound only while labels
  drew exclusively with the scene uniform; it now caches per uniform
  buffer like the other pipelines.
- **Pixel-diff harness** (`playwright-tests/lib/image-diff.mjs`;
  pixelmatch + pngjs as devDeps): decode, rect masking, tolerance diffs,
  failure artifacts (actual/expected/diff PNGs), and
  `compareToGolden` with an `UPDATE_GOLDENS=1` regen flow.
- **WYSIWYG self-diff** (no golden needed): a viewport export at scale 1
  pixel-matches a screenshot of the live canvas (≤ 0.1% of pixels) over a
  scene exercising all four pipelines — pins the export path to the
  screen path both ways.
- **v4 goldens** (new `webgpu-visual` Playwright project, pinned to
  SwiftShader via `--use-webgpu-adapter=swiftshader` so rasterization is
  machine-independent): four checked-in scenes — shapes/borders/opacity/
  arrows, the selection accent ring, GPU-evaluated color mappers, and
  far-zoom LOD (floors, decimation, plain discs).  Goldens stayed
  label-free in this round — SDF glyphs raster via OS fonts, which is
  not cross-platform stable — superseded in round 9.7, where a fixed
  web font made a label golden possible.
- **v3 parity** (`playwright-page/parity.html` loads both UMD bundles):
  the same fixture rendered by both renderers in the same run, exports
  diffed in memory — nodes/borders/opacity/straight edges, and a
  zoom+pan transform case; one look in two dialects (v3 selector blocks
  vs v4 case mappers).  Interiors agree exactly; AA differs by design,
  so the specs bound the mismatch ratio (measured 0.5–0.8%, asserted
  ≤ 2%).  Two v3 gotchas guarded: v3's default layout is 'grid' (parity
  passes an explicit preset layout, `fit: false`), and v3 adopts
  position objects by reference (each side deep-copies the defs).
- **Verification**: 1452 Node tests + 47 module tests, typecheck and lint
  clean, 32/32 `webgpu` + 6/6 `webgpu-visual` Playwright specs; goldens
  byte-stable across repeat runs.

## Landed (round 9.7 — label testability + `font-family`, 2026-07-27)

Direction set in discussion (amendment to round 9.6: "it's important to
test labels").  The 9.6 goldens excluded labels because the atlas
hardcoded `32px sans-serif` — the browser's *generic* sans-serif, which
resolves to a different font per OS, making label pixels unpinnable even
in principle.  The package, with the load-bearing piece being a missing
API, not harness design:

- **`font-family` as a constant, effectively global node style prop**
  (default `sans-serif`) — the atlas is keyed by character, one font per
  atlas by design, so per-element fonts (atlas re-keyed by (font, char))
  are out of scope; mappers for the prop and the edges-group form throw.
  A change routes `store.labelFont` → atlas reset (cache/pen/full +
  re-measured ascent, same texture object so bind groups survive) → all
  labelled slots marked label-dirty → one `LabelLayer.process()` pass
  rebuilds every glyph run against the new metrics.
- **A vendored OFL web font for the specs** (`@fontsource/open-sans` as
  a devDependency; `@font-face` in the test pages; specs `await`
  `document.fonts.load` *before* instance creation).  The pre-load
  matters because the atlas rasters lazily and caches forever: a glyph
  built before the font loads is cached from the fallback with no
  invalidation.  A `document.fonts.ready` re-raster hook for the library
  is logged as a follow-up, not built here.
- **Label goldens as their own tolerance tier** in `webgpu-visual`: the
  fixed font pins glyph shapes/metrics and SwiftShader pins the GPU, but
  Chrome's atlas raster still goes through CoreText (macOS) vs FreeType
  (Linux), so label goldens get a looser bound (threshold ~0.25, ratio
  ~2%) than geometry goldens (0.5%).  Escape hatch if CI disagrees:
  per-platform golden suffixes.  A font-swap Playwright spec proves the
  atlas rebuild path (pixels change when the sheet's font changes).
- Already covering labels and unchanged: the WYSIWYG self-diff
  (same-machine export-vs-screen, includes glyphs) and the behavioural
  label specs (placement, follow-on-drag, LOD fade).  v3 parity keeps
  excluding labels — raster and placement differ by design.
- **Verification**: 1461 Node tests (9 new font-family specs) + 47
  module tests, typecheck and lint clean; 33/33 `webgpu` (incl. the
  font-swap spec) and 7/7 `webgpu-visual` specs (incl. the
  `labels-open-sans` golden), the visual project stable across three
  consecutive runs.

## Logged direction — edge labels (built in round 10 B5, exactly this shape)

Needed regardless (discussion, 2026-07-27).  A generalization, not new
architecture: a **second glyph stream** parallel to the node one (own
instance buffer + cull group + draw); edge glyphs anchor at the edge
midpoint computed in the VS from the two endpoint positions, so edge
labels follow drags/layouts/position tweens on-GPU with zero rebuild —
the node-label trick extended to labels whose *endpoints* move.  Cull
predicate mirrors the edge cull (edge SHOWN + both endpoints SHOWN);
the atlas is shared (keyed by char, so the 9.7 font work is
owner-agnostic); the model side group-keys the label sidecar,
label-dirty channel and StyleEngine label channels.  Pass-1 scope:
horizontal at the midpoint (v3's default); autorotate — cheap in the VS
via the endpoint delta, but with flip-when-upside-down readability
rules — is a separate follow-up call (since landed 2026-07-29).  Sequencing: after 9.7, so the
label goldens/WYSIWYG harness exists to verify it; the edge-label round
then just adds a golden scene.

## Round 10 plan — autonomous parity sprint (planned 2026-07-27)

Scope criteria set with the user: this round is composed **only of items
whose design is already decided** (or is a mechanical v3 port) **and
that are easily verifiable in the existing harnesses** — Node
`test/gpu-*.mjs`, the `webgpu`/`webgpu-visual` Playwright projects,
`benchmark/gpu/` — so the round can run autonomously as far as
possible.  Anything needing iterative design discussion is deferred and
logged (see the compaction section below and the deferred list at the
end).  Two design calls were made during planning:

- **Removed elements are terminally dead in v4** (recorded in
  `src/gpu/README.md`, "Design decisions"): only the handle's cached
  `id()`/`group()` survive removal.  This permanently closes
  `restore()`/`clone()`/`cy.json()` import — the needs-a-call entry
  above is closed.
- **Compaction is out of this round** — the motivation analysis is
  logged below with all policy calls left explicitly open.

Process (user-set):

- **Per-item cadence, full verify.**  Each item lands as its own
  isolated commit(s) on `v4`, gated on typecheck + lint + `test:js`
  (+ `test:modules` where relevant) + the relevant Playwright projects.
  Goldens are regenerated/added autonomously when a visual change is
  intended (`UPDATE_GOLDENS=1`), noted in the commit message.
- **Docs land in the same commit as the code they describe**:
  `src/gpu/README.md` (scope / deviations / design decisions) and this
  file's round record are updated per commit, not batched at the end.
- **Escalation rule**: if an item turns out to need a real design call
  mid-implementation, stop that item, log the question under "Needs a
  call", and move on to the next item — API semantics are never
  improvised autonomously.
- Perf-relevant items run the matching `benchmark/gpu/` sweep and
  record numbers here.

**Round complete (2026-07-27): all 17 items landed**, each as isolated
commits with docs in-commit and the full verification gate per item.
Net across the round: 1461 → 1629 Node tests, 33 → 44 `webgpu` + 7 → 14
`webgpu-visual` Playwright specs (51 total), 7 new golden scenes, and
the full v3 algorithm surface, four more layouts, viewport animation
targets, data query predicates, ten node shapes, line styles, label
visuals, arrow shapes, edge labels, the gesture set, mount/unmount and
device-loss recovery in v4.

Items, in execution order — CPU-first (banks autonomous wins with zero
renderer risk), then shader/golden work, then interaction/lifecycle.
Each entry converts into a "Landed" record as it ships:

**Phase A — pure CPU, Node-testable**

- [x] **A1 Algorithms: search + paths** — landed 2026-07-27.
  `bfs`/`dfs` (+ `breadthFirstSearch`/`depthFirstSearch`), `dijkstra`,
  `aStar`, `bellmanFord`, `floydWarshall`, `kruskal` in
  `src/gpu/algorithms/` (a shared `SubgraphView` — dense node index +
  edge membership over the calling collection — plus an indexed
  binary min-heap in `algo-shared.mts`; one file per algorithm), all
  slot-native over CSR with dense typed-array state, no per-node
  string ids.  v3 option/result shapes preserved, including the
  positional bfs/dijkstra forms, bfs's exact multi-root queue
  mechanics, bellmanFord's same-edge relax guard and canonical
  negative-cycle rotation, and pathTo edge cases (unreachable
  dijkstra target → `[target]`, unreachable bellmanFord target →
  empty).  v4 deltas: node args are collections (strings throw),
  missing required roots/goals throw, and cycle collections dedupe
  the closing node (v4 collections are sets).  39 specs in
  `test/gpu-algorithms.mjs` ported from the v3 fixtures (1500 Node
  tests total green).
- [x] **A2 Algorithms: structure** — landed 2026-07-27.
  `tarjanStronglyConnected` (+`tsc`/`tscc`/long alias; converted to an
  **iterative** DFS so deep graphs can't overflow the JS stack —
  component sets identical to v3's recursive form, verified against
  the v3 fixtures including exact component order),
  `hopcroftTarjanBiconnected` (+`htbc`/`htb`/long alias; recursive
  like v3, quirks preserved: parent edges skipped incl. parallels,
  non-cut vertices' edges absorbed), `hierholzer` (slot-keyed literal
  port; trail dedupes to first-traversal order as v3's does),
  `kargerStein` (index-based port; throws on <2 nodes as v3's error()
  does).  Tests assert order-independent graph-theoretic results
  (blocks, cut vertices, Eulerian properties) where v3 pinned
  traversal-order sequences; 12 specs in
  `test/gpu-algorithms-structure.mjs` (1512 Node tests green).
- [x] **A3 Algorithms: pageRank + centralities** — landed 2026-07-27.
  `pageRank` (dense power method on Float64Arrays), `degreeCentrality`
  /`degreeCentralityNormalized` (+`dc`/`dcn`/`...Normalised`; Opsahl's
  alpha, loops counted on both directed sides as v3), `closeness
  Centrality`/`closenessCentralityNormalized` (+`cc`/`ccn`; harmonic
  default; dijkstra per root, floydWarshall for normalized),
  `betweennessCentrality` (+`bc`; Brandes over deduped neighbor lists
  with first-edge weight pick as v3, but a proper decrease-key heap so
  S is truly distance-ordered).  19 specs pin v3's exact numeric
  expectations (all matched, incl. the multiple-shortest-paths case);
  `test/gpu-algorithms-centralities.mjs` (1531 Node tests green).
- [x] **A4 Algorithms: clustering** — landed 2026-07-27.  `kMeans`,
  `kMedoids`, `fuzzyCMeans`/`fcm`, `hierarchicalClustering`/`hca`
  (threshold + dendrogram modes, `addDendrogram`), `markovClustering`/
  `mcl` (Float64Array matrices), `affinityPropagation`/`ap`, plus the
  shared `clustering-distances` metric module.  The attribute-space
  algorithms stay handle-level like v3 (they're feature-space, not
  adjacency walks); markov builds its matrix off the slot view.  v3
  quirks preserved: raw-option validation for affinity (damping and
  preference effectively required), the 2-arg custom distance form
  when no attributes are given, kMedoids' k>n throw.  25 specs pin the
  v3 fixtures' numeric expectations (k-means/k-medoids/fcm/markov
  cluster memberships in exact order, dendrogram levels 0–10);
  affinity gets a compact deterministic fixture instead of v3's
  700-line one.  `test/gpu-algorithms-clustering.mjs` (1556 Node tests
  green).
- [x] **A5 Algorithm benchmark** — landed 2026-07-27.
  `benchmark/gpu/algorithms.mjs` (standalone Mitata sweep; superlinear
  ops gate on BENCH_N).  At N=2000 (4k edges) the slot-native walks win
  every op vs v3: bfs 34×, dfs 39×, dijkstra+pathTo 33×, bellmanFord
  22×, kruskal 14×, tarjan SCC 19×, hopcroft-tarjan 20×, betweenness
  13×, degreeCentralityNormalized 22×, closenessCentrality 31×, aStar
  2.1×, hierholzer 2–3×.  The dense-matrix ops are parity, as expected
  (identical math dominates): pageRank/floydWarshall/markov/
  hierarchical/kMeans all within ±1.2× at N=500.
- [x] **A6 Layouts** — landed 2026-07-27.  `circle`, `concentric`,
  `breadthfirst`, `random` (handle-level ports of the v3 math — these
  layouts are per-node-callback-shaped, unlike grid's slot path), plus
  the v3 plumbing on the collection: `layoutDimensions`,
  `layoutPositions` (spacingFactor scaling, `transform`, fit/zoom/pan,
  the layoutstart/ready/stop event flow, and `animate: true` via the
  existing animation system — handle-memoized, `animateFilter`
  honored; the fit applies at layoutstop until A7's animated fit), and
  `eles.layout()`/`makeLayout`/`createLayout` (grid and preset honor
  `eles` scoping too, incl. fit-to-eles).  Two corrections vs the
  repo's v3 files, both noted in code: circle calls layoutPositions on
  the *sorted* collection (upstream v3 behavior — the repo's TS port
  calls it on the unsorted one, so `sort` does nothing there), and
  breadthfirst compacts the nulls left by maximal shifts before
  sorting a depth (v3 passes them into its comparator).  28 specs in
  `test/gpu-layouts.mjs` (1584 Node tests green).
- [x] **A7 Viewport animation targets** — landed 2026-07-27.
  `cy.animate`/`cy.animation` (the handle form is new, mirroring
  `eles.animation`) take `fit: { eles | boundingBox, padding }` and
  `center: { eles }`, resolved to concrete pan/zoom at creation time
  (v3 semantics — pinned by a spec that moves a node after creating
  the animation); fit/center bypass the pan/zoom gating flags, like
  `fit()` itself.  `eles.boundingBoxAt(posOrFn)` landed with it
  (side-effect-free direct computation, edges spanning out-of-
  collection endpoints at current positions) — pulled forward from A9
  because the animated layout fit needs it: `layoutPositions` with
  `animate: true` now animates the viewport to the final arrangement's
  box concurrently with the node tweens, exactly v3's shape (the A6
  fit-at-layoutstop compromise is gone).  Note: v3's animated
  `fit()`/`center()` *options* don't exist in v3 either — the target
  form is the parity surface.  9 specs in
  `test/gpu-viewport-animation.mjs` (1593 Node tests green).
- [x] **A8 Data query predicates** — landed 2026-07-27.  `GpuQuery`
  gains `data: { key: value | { eq/ne/lt/lte/gt/gte/in } }` (bare
  value = `eq`; keys AND together), compiled to `CompiledCondition[]`
  on the plan and evaluated with the *same* `testCondition` the `case`
  mapper uses (missing value fails every op, `ne` included; exactly
  one op per condition; `in` non-empty; ordinal ops numeric — all
  throwing as the mapper does).  The whole-graph scan
  (`scanRefsInto`) takes the tests with per-key column readers hoisted
  out of the loop (`DataStore.reader`); the collection-filter and
  `planMatchesRef` paths apply them too.  10 specs in
  `test/gpu-query-data.mjs` (1603 Node tests green).
- [x] **A9 Small items** — landed 2026-07-27.  (`boundingBoxAt` landed
  with A7.)  `padding()`/`paddedWidth`/`paddedHeight`: accessor-only —
  v4 has no `padding` style prop (compounds-era), so padding reads 0
  and padded dims equal plain dims; kept so v3 call sites work.
  **`cy.serialize()`**: live-graph export to the wire ArrayBuffer
  (ids, positions, selected/selectable flags, and the data() sidecar
  via `DataStore.exportColumns` — numbers as f64+NaN holes, strings as
  dictionary columns, mixed as arrays), round-tripping through
  `options.elements`/`cy.add()`; 7 Node specs incl. selection state,
  post-load mutations and empty graphs.  **Web-font re-raster hook**:
  the renderer listens for `document.fonts`'s `loadingdone` and
  re-rasters the atlas + rebuilds all glyph runs (`GlyphAtlas.
  reraster`, `store.markAllLabelsDirty`), closing 9.7's
  cached-fallback-glyph footgun; removed on destroy.  Playwright spec
  registers a FontFace *after* the label renders and pins the pixel
  change (an @font-face family can't test this — the atlas's own
  canvas use starts its load).  Verified: 1610 Node + 47 module tests,
  34 webgpu + 7 webgpu-visual Playwright specs on a fresh bundle
  (note: a stale http-server on :3333 silently serves an old bundle to
  Playwright — kill it before trusting a run).

**Phase B — renderer/shader work, golden-verified**

- [x] **B1 Node shape parity** — landed 2026-07-27.  Ten polygon
  shapes (`triangle`, `pentagon`, `hexagon`, `heptagon`, `octagon`,
  `diamond`, `rhomboid`, `vee`, `star`, `tag`, + `square` alias) from
  **one point-table source of truth** (`shape-points.mts`, built with
  the same shared math generators v3's node-shapes registration uses —
  identical geometry).  Shape ids 4–13 in `contract.mts`; WGSL
  per-shape SDF functions are *generated* from the tables (iq's
  sdPolygon, vertices scaled by half-size so the device-space distance
  is exact — first cut evaluated in normalized space and showed
  smeared borders on stretched nodes in the golden; exact-space fixed
  it); CPU pick uses exact point-in-polygon in normalized space
  (inside-ness is affine-invariant); the depth prepass treats polygon
  interiors via their SDF (conservative rect/roundrect/ellipse
  fast paths kept).  `round-*` polygon variants deliberately not
  ported (no clean closed form under anisotropic scale) along with
  cut-rectangle/barrel/etc — README records the list.  Verified: 5
  polygon CPU-pick specs (incl. concave star/vee and an anisotropic
  hexagon), keyword parse+readback specs, and a `polygon-shapes`
  golden (11 nodes incl. a selected star's accent ring and a stretched
  hexagon), stable across repeat runs; 1617 Node + 47 module tests,
  42 Playwright specs green.
- [x] **B2 `line-style: solid | dashed | dotted`** — landed
  2026-07-27.  New `edge.lineStyle` column (contract LINE_* ids) with
  the full style plumbing (keyword parse, case mappers, stored-truth
  readback); the edge VS emits a model-px longitudinal varying and a
  flat style id, and the FS applies an AA'd dash mask (v3's patterns:
  dashed [6, 3], dotted [1, 1], model units so dashes zoom with
  content).  Picking ignores gaps as v3 does; the pick FS is
  untouched.  `border-style` skipped per the plan's stretch clause
  (dashing an SDF boundary needs perimeter parameterization) — README
  records it.  `line-styles` golden (three styles + a wide diagonal
  dashed edge proving the pattern runs along the edge); 1618 Node +
  47 module tests, 43 Playwright specs green.
- [x] **B3 Label visuals** — landed 2026-07-27.  `text-outline-width`/
  `-color`/`-opacity` (second SDF threshold in the label FS; width
  precomputed CPU-side into SDF sample units), `text-background-color`
  /`-opacity`/`-padding` (a solid quad instance preceding the run's
  glyphs — a negative-u0 sentinel skips the atlas sample; it carries
  the glyph block's height so LOD fade/cull match the text exactly),
  `text-margin-x/y` (margin-y folds into the anchor; both kept in the
  entry for readback).  All eight props are **mapper-capable** (added
  to the MAPPABLE table; `applyMapped` writes whole elements so the
  label sidecar rebuilds through the existing path).  Glyph instances
  grew 40 → 48 bytes (outline color + width).  Two WGSL
  uniform-control-flow traps hit and fixed: `textureSample` and
  `fwidth` both hoisted above the solid-quad branch (caught by the
  validation-error guard).  `label-visuals` golden (outline, boxed,
  margin-shifted) at the label tolerance tier; 1619 Node + 47 module
  tests, 44 Playwright specs green.
- [x] **B4 Arrow shape parity** — landed 2026-07-27.  `vee`,
  `chevron`, `circle`, `square`, `diamond`, `tee` (+ the `arrow`
  alias), with WGSL SDFs generated from v3's arrow point tables
  (shared `ARROW_POINTS` in shape-points.mts; tip-at-origin frame,
  uniform scale — v4's arrow sizing turns out to be exactly uniform:
  halfBase/0.15 == arrowLen/0.3).  The arrow FS now evaluates a
  shape SDF in the arrow-local frame instead of the triangle's
  lateral-taper mask (the triangle's geometry is unchanged, only its
  AA method — nodes-edges-arrows golden regenerated); shape ids pack
  source|target<<8 into a new `edge.arrowShapes` column bound
  **fragment-only**, keeping the arrow VS at its 8-storage-buffer
  budget.  Readback keeps the stored-truth rule (transparent arrow →
  shape 'none'), now returning the real keyword otherwise.  Compound
  shapes not ported (README lists them).  `arrow-shapes` golden (7
  target shapes + a source-end chevron pinning the byte order);
  1621 Node + 47 module tests, 45 Playwright specs green.
- [x] **B5 Edge labels pass 1** — landed 2026-07-27, exactly the
  logged shape.  Model: the label sidecar, label-dirty channel and
  `setLabel`/`labelAt`/`takeLabelDirty` are **group-keyed** (trailing
  group param defaulting to 'nodes', so node call sites read
  unchanged); StyleEngine's label channels — the passthrough `label`,
  `font-size`, `color` and all the B3 text visuals — now compile for
  edges too (the edge write path calls the shared `writeLabel`, edges
  centering on the midpoint by font size).  Renderer: a second
  GlyphBuffer in the LabelLayer, an `edgeGlyph` cull kind (predicate =
  edge SHOWN + both endpoints SHOWN + fade/min-height + viewport at
  the midpoint), and the label shader generated for both streams from
  one template — the edge variant binds `edge.endpoints` and computes
  the **midpoint anchor in the VS**, so edge labels follow drags/
  layouts/position tweens on-GPU with zero rebuild (spec-pinned: an
  endpoint move re-uploads ≤64 B and the label lands at the new
  midpoint).  Also fixed en route: a hardcoded 40-byte glyph stride in
  the renderer's cull-capacity math (stale since B3's 48-byte
  instances; benign over-allocation) now uses GLYPH_BYTES.  Horizontal
  only — autorotate stayed the separate follow-up (since landed
  2026-07-29; see the autorotate entry below).  7 model specs
  (`test/gpu-edge-labels.mjs`), the follows-drag webgpu spec, and an
  `edge-labels` golden (midpoint + background box on a diagonal edge);
  1628 Node + 47 module tests, 47 Playwright specs green (twice).

**Phase C — interaction & lifecycle, Playwright-verified**

- [x] **C1 Gesture parity** — landed 2026-07-27.  Right button:
  `cxttapstart`/`cxtdrag`/`cxttapend` + `cxttap` (no-move), with the
  canvas context menu suppressed; `taphold` after a 500 ms unmoved
  press; `dbltap` on a same-target second tap within
  `cy.multiClickDebounceTime()` (default 250 ms; new ctor option +
  validated getter/setter) plus the debounced `onetap`; and
  drag-all-selected — grabbing a selected node collects every
  draggable selected node into a drag set moved by one bulk `shift`
  per pointermove (all flagged grabbed, unflagged on release/cancel).
  Verified by two Playwright specs (the event-order cxttap/dbltap/
  taphold sweep and a three-node drag-set spec) + a Node accessor
  spec; 1629 Node + 47 module tests, 49 Playwright specs green
  (serial run; parallel runs on this loaded machine flake one
  arbitrary visual spec — an env issue, not a code one).
- [x] **C2 `mount`/`unmount`** — landed 2026-07-27.  The factory's
  renderer+pointer wiring moved into a reusable `_attachFn` on the
  core (with the WebGPU-availability check at attach time);
  `unmount()` destroys pointer + renderer and the instance reads
  headless with a resolved `ready`; `mount(container)` re-attaches a
  fresh renderer — the new ColumnMirror's from-zero realloc re-uploads
  every column, and `markAllLabelsDirty()` requeues every glyph run
  (the old LabelLayer had consumed the dirty channel).  Same-container
  re-mount no-ops; a different container unmounts first;
  `cy.destroy()` now also tears the pointer down.  Playwright spec:
  render → unmount (headless, canvas removed, png rejects) → move/
  relabel/add while headless → mount → the moved node, its rebuilt
  label, and the headless-added node all render.  1629 Node + 47
  module tests, 50 Playwright specs green (serial).
- [x] **C3 Device-loss recovery** — landed 2026-07-27, with the
  proposed policy recorded as the decision: an external loss emits
  `devicelost` and auto-recovers **once per loss** by re-mounting a
  fresh renderer against the same container via C2's machinery (the
  model is CPU-canonical, so mirrors/pipelines/glyph runs all
  rebuild), then emits `devicerestored`; a loss during recovery or a
  failed re-acquisition goes headless-dead + `error` (the previous
  behavior).  Plumbing: `gpu-context` now surfaces *every* loss and
  the renderer distinguishes its own teardown by its `destroyed` flag
  (so `renderer.destroy()` stays silent); a `_debugLoseDevice()` test
  hook destroys the device externally.  Playwright spec: lose the
  device → `devicelost` → `devicerestored` → post-loss writes render.
  1629 Node + 47 module tests, 51 Playwright specs green (serial).

Deferred out of this round (logged, not built): compaction (below;
the slot-stable tier since landed as round 11, the slot-moving tier
as round 19); autorotated edge
labels (since landed 2026-07-29); multiline labels (since landed,
round 16); bezier edges
(round-12 plan written; passes 12a/12b/12c since landed — round 12
is complete);
compounds (since landed, round 14);
z-index (since dropped by decided design, 2026-08-01); GPU layouts
(since landed, round 18); size tweens (the R8.5 geometry seam);
`renderTo`;
restore/clone/json-import (closed — not in v4); the three-finger touch
box gesture (since landed, round 20.5).

## Landed (renderer benchmarks, 2026-07-28)

The renderer's recorded numbers (fps tables, pan ms/frame, pick latency,
init/export costs) were manual debug-harness measurements; this makes
them a repeatable command.  `npm run benchmark:gpu:renderer` (or
`benchmark:gpu:report -- --renderer` to fold into the combined report)
runs `benchmark/gpu/render-bench.mjs`: a Playwright-library driver (not a
test project — no assertions, not in CI's sweep) that serves the repo on
an ephemeral port (no stale-:3333 dependence; bundle-vs-src mtimes are
checked and warned), launches Chromium `channel: 'chromium'` with
`--enable-unsafe-webgpu`, **aborts without a real adapter** (software
adapters warn — different machine class), and drives
`render-bench.html`: one instance at a time on a shared stage, seeded
25k×50k / 100k×300k generators + stripped ndex-x-large, v3 canvas vs v4
WebGPU on identical defs and constant styles.  Scenarios: continuous-pan
steady state (fit-all / zoomed-in 20× / far-zoom ÷8, labels off/on) —
programmatic `panBy` per rAF, warm-up then sampling until window + a
minimum frame count; wall ms per *rendered* frame (v4: `stats().frames`
delta, since backpressure skips ticks; v3: the tick delta, since the
canvas draw runs inside it) as the comparison metric, with
`stats().gpuFrameMs` (timestamp-query) as `gpu (device)` rows — the
vsync-unbounded cost; hover-while-panning `pick()` latency percentiles;
one-shot init / columnar init / full-png export (≤2048 px — full-graph
exports would exceed the device texture cap).  dpr 2, 1280×800, render
scale pinned to 1.  Results emit the same mitata-shaped stats
(`render-stats.mjs`, unit-tested) so `report-html.mjs` renders renderer
sections unchanged; jobs carry a `note` (new, rendered once per section)
stating the vsync bound and pinned config.  First full run (M2, Metal,
dpr 2), fit-all pan p50 v3-vs-gpu wall: 336 ms vs 10.6 ms at 25k×50k
(device 7.8 ms; far-zoom device 2.1 ms — decimation), 2.05 s vs 15.2 ms
at 100k×300k, 1.86 s vs 32.8 ms on ndex-x-large (~30 fps native,
matching the round-recorded "25 fps before adaptive scale"); init 7.7 s
vs 457 ms at 100k; ndex pick p50 0.1 ms (the CPU fast path).

## Landed (benchmark HTML report, 2026-07-28)

`npm run benchmark:gpu:report` runs the Mitata suites and renders one
self-contained HTML page (plus a timestamped results JSON) into the
gitignored `benchmark/gpu/results/`.  Pieces: `bench-run.mjs` — a shared
`finishRun()` tail that, under `BENCH_JSON`, runs quietly and captures
per-group/per-bench stats (mitata's `run()` returns them; sample arrays
stripped) with terminal behaviour otherwise unchanged; `report.mjs` — the
job-table orchestrator (quick profile at default scales; `--full` adds
the 2k/20k/200k matrix with one process per group at 200k via `BENCH_OP`,
per the suite headers; failures logged and reported, partial reports
still render; `--suite` filter, `--render-only` re-render); and
`report-html.mjs` — a pure results→HTML renderer (Node-tested in
`test/modules/gpu-benchmark-report.mjs`): times as dumbbell dots on log₁₀
axes (position, not bar length — length encodes nothing on a log axis),
a ranked speedup overview against a 1× reference line, geo-mean/best-win
stat tiles, per-suite table views, a cross-N scaling table on full runs,
light+dark styling, hover/focus tooltips, no external assets.  Decisions:
quick-by-default (full is opt-in), local gitignored artifact, Mitata
suites only — the browser-side numbers stayed manual at this point
(since superseded: the renderer benchmarks above made them a command,
folded in via `--renderer`).

## Landed (round 11 — slot-stable compaction, 2026-07-29)

The buildable tier from the compaction analysis (next section): the
append-only structures that leak under churn now meter their waste and
reclaim it automatically on a threshold, extending the policy the
insertion-order list has always used (`compactOrder` at > half stale).
No element slot moves — refs, draw order and the GPU mirrors are
untouched — which is what the analysis identified as making
auto-trigger safe for this tier; the *slot-moving* tier's policy calls
(ref survival, trigger, draw order) stay open below.  Each piece lands
as an isolated commit with Node tests.

- **En route fix**: adjacency's `overlayCount` counted +1 per
  `addEdge` but decremented per overlay-list entry (an edge holds two:
  `out[source]` + `inn[target]`), so it could hit zero with entries
  still live and let `addBulk` build a "fresh" CSR under a non-empty
  overlay, drawing bulk edges ahead of earlier incremental ones in
  per-node incident order.  It now counts entries; regression test
  pins the ordering.
- **Id blob** (`store/id-map.mts`): `remove()` meters the removed id's
  stranded UTF-8 bytes; when they exceed half the blob (≥ 4 KiB
  floor), the live ranges compact into a fresh right-sized blob, so
  peak-then-small graphs also shrink back toward the floor.  The probe
  table stores (group, slot) codes, never byte offsets, so it — and
  the per-slot hashes and decoded-name cache — survive compaction
  untouched; probe-table tombstones already self-reclaimed via the
  rehash in `ensure()`.  Cost is O(live bytes), amortized over the
  removals that stranded the waste.  A 20k add/remove churn loop that
  used to strand ~200 KB now holds the blob ≤ 8 KiB.
- **CSR adjacency** (`store/adjacency.mts`): removals strand CSR
  entries (fixed per-node segments can't refill) and post-build adds
  accumulate in the per-node overlay arrays — both metered now
  (`csrStranded`/`overlayEntries`).  When their sum exceeds half the
  live entry count (64-entry floor), `GraphStore` rebuilds CSR from
  the live edges in insertion order — the same two counting passes as
  the bulk build — folding the overlay back into the compact typed-
  array shape and dropping the stranded space.  Insertion order is
  what the incremental paths produce anyway, so per-node incident
  order is preserved across a rebuild (the one exception: an edge
  re-pointed by `moveEdge` sits at its re-add position until a rebuild
  returns it to insertion order).  A side effect closes a gap from
  round 5: a *purely incremental* graph (never bulk-loaded) used to
  keep all its edges in JS overlay arrays forever; it now folds into
  CSR once past the floor, at geometric intervals (amortized O(1) per
  add).
- **String dictionaries** (`store/data-store.mts`): dicts only grew,
  so entries whose last reference was overwritten or cleared leaked
  under churn.  String columns now keep a per-entry refcount (one
  extra indices read per write); when dead entries exceed half the
  dict (8-entry floor) the dict compacts — live entries keep their
  relative order, the indices column remaps **in place** (bound CPU
  evaluators hold the array and col by reference), and a per-column
  `epoch` bumps.  Values never change, only the private index space,
  so no mapper output moves (ordinal domains are explicit — there is
  no dict-order-derived domain).  GPU interplay: `onDictRemap` →
  `GraphStore.markDataWrite` over the whole column (watched keys
  re-upload their remapped index shadow), and the mapper runtime packs
  `dictEpochs` beside `dictSizes` — the span handler reconfigures on
  either mismatch, since a same-frame shrink-then-regrow can return
  the dict to its packed *length* with a different index mapping
  (spec-pinned: the epoch test fails on the length check alone).  The
  ingest path also compacts adopted wire dicts that arrive with
  unreferenced entries.

**Verification**: typecheck, lint, `test:js` (1638 → 1645) and
`test:modules` (58) green per commit.  Write-path cost checked against
the pre-round baseline (`benchmark/gpu/mutators.mjs` at N=2k, same
machine, same run): remove+re-add 5.45 vs 5.32 ms/iter (noise), data
set at parity — after re-splitting the DataStore write path so the
numeric case stays inlinable (the first cut regressed numeric bulk
writes ~16% by growing `write()` past the inline budget; caught by the
baseline comparison, pinned back to 50.5 vs 50.7 µs).  Churn
measurement (sliding-window store scenario: 20k nodes / ~21k edges
stable, 1k-node bands removed and re-added with fresh ids and
per-element strings): after 40 rounds the id blob holds 699 KB vs
1.84 MB pre-round, the string dictionary 21.2k entries vs 60k, and
adjacency lives in typed-array CSR (38k live entries, 41k capacity,
4k overlay) vs 42k permanent JS-array entries; at 80 rounds the
pre-round numbers keep growing linearly (3.03 MB blob / 100k dict)
while round 11 stays flat (492 KB / 23.1k) — churn profile 2's
unbounded-in-time leak is closed.  The `webgpu` Playwright projects
could not be validated on this Linux machine: the SwiftShader adapter
acquires (vendor google/swiftshader) but renders blank — identical
failures on the pre-round baseline commit, so a pre-existing
environment limitation, not this round; the mapper-runtime
epoch/repack behaviour is pinned by the Node mock-device suite
instead, and the webgpu projects should be re-run on a machine with a
working adapter before release.  (**Resolved 2026-07-29** — the blank
rendering was a Linux canvas-presentation issue in headless Chromium,
fixed with ANGLE-on-Vulkan compositing flags; all 51 specs now pass on
this machine.  See the next entry.)

## Landed (Linux WebGPU test environment fix, 2026-07-29)

Root-caused and fixed the "adapter acquires but renders blank" failure
that kept the `webgpu`/`webgpu-visual` Playwright projects from
validating on Linux (round 11's open verification debt).  Probing the
Playwright-launched Chromium (1.61.1, `channel: 'chromium'` new
headless) with the failure split into stages showed:

- **Dawn rendering was never broken.**  With the repo's flags, the
  adapter acquires and an offscreen render → `copyTextureToBuffer` →
  map readback produces correct pixels on *both* the SwiftShader
  adapter and the hardware one (RX 580, RADV, Mesa 25.3.6 — Vulkan 1.4
  is healthy on this box).
- **Canvas *presentation* was the failure.**  Under the default Linux
  GL compositor, `ctx.configure()`/`getCurrentTexture()` on a WebGPU
  canvas killed the instance ("A valid external Instance reference no
  longer exists"); under `--use-angle=vulkan` alone the canvas
  configured but composited transparent.  Composited (screenshot)
  pixels — what the specs assert — stayed blank either way, which is
  exactly the round-11 symptom.
- **The fix**: `--use-gl=angle --use-angle=vulkan
  --enable-features=Vulkan` routes Chromium's compositor through
  ANGLE-on-Vulkan, and the shared-image canvas path presents
  correctly for both the hardware and the SwiftShader-pinned WebGPU
  adapter.  Added to the `webgpu` and `webgpu-visual` projects in
  `playwright.config.js`, gated on `process.platform === 'linux'` —
  `--use-angle=vulkan` does not exist on macOS (Metal), so the
  known-good macOS configuration is untouched.
- **Determinism and CI are unaffected.**  The SwiftShader pin still
  applies to the *WebGPU* adapter (only compositing uses the AMD
  device), and the goldens generated on macOS pass here unchanged —
  confirming cross-platform golden stability.  Simulating a
  no-Vulkan-driver machine (a CI runner) yields a null adapter → the
  specs soft-skip exactly as before, so CI behaviour is unchanged.
- One quirk noted, no action needed: `drawImage()` from a live WebGPU
  canvas into a 2D canvas still reads transparent under these flags —
  no spec uses that path (they decode `page.screenshot()` or use
  `cy.png()` readback, both working).

**Verification**: 39/39 `webgpu` + 12/12 `webgpu-visual` specs green
on this machine (all 10 golden diffs within tolerance against the
checked-in macOS-generated PNGs, both v3-parity diffs within their 2%
bound) — round 11's "re-run on a machine with a working adapter"
caveat is cleared, and this Linux machine can run the visual projects
going forward.

## Logged — compaction (analysis; slot-stable tier landed round 11)

Discussed 2026-07-27 while planning round 10 and **deliberately left
out of that sprint**: the analysis below is settled.  The
**slot-stable tier landed in round 11** (above) with auto thresholds —
the "plausibly auto regardless" lean below, taken.  The *slot-moving*
policy calls were decided with the user 2026-08-01 and **the tier
landed as round 19** (the plan and Landed sections at the end of this
file); the analysis below is kept as the record that motivated it.

**When compaction is motivated** — three distinct profiles:

1. **Shrink** (big removals without re-add — e.g. a filter UI cuts 200k
   elements to 20k).  Dead slots pile up and `highWater` never falls:
   every compute dispatch (cull count/scan/scatter, mapper eval) still
   runs over `highWater` lanes; every CPU columnar scan
   (`scanRefsInto`, `boundingBox`, `refsInBox`, CPU pick) still
   iterates `highWater` slots — cost proportional to the *peak* graph,
   not the current one.  CPU columns and GPU mirrors stay at peak
   capacity, and one-coalesced-span dirty tracking uploads dead bytes
   when writes straddle dead regions.
2. **Churn** (sustained remove+add at stable size — streaming /
   sliding-window dashboards, expand/collapse exploration).  The
   free-list recycles slots, so the tables don't grow — but three
   append-only structures leak unboundedly in *time*: the **id blob**
   (removed ids' UTF-8 bytes + probe entries never reclaimed; new ids
   append fresh bytes), the **CSR adjacency** (removed edges strand CSR
   space; incremental adds accumulate in the per-node overlay), and
   **string-dictionary data columns** (dictionaries only grow).  This
   is the most motivated real-world case — and it is invisible to a
   dead-slot-ratio meter, since slots recycle.
3. **Peak-then-small memory reclaim** (transient huge load, then
   narrow): capacity stays at peak until slots compact and columns
   realloc down.

Not motivated: add-only or stable graphs (zero waste), and moderate
removal on big graphs (cull already keeps draw cost O(visible); dead
slots only cost pass-iteration width and memory).

**The tier split** — the tiers differ by trigger meter, not just
difficulty.  Blob/CSR/dictionary compaction is **slot-stable**: no
identity moves, no renderer or ref implications, metered by plain waste
counters — it could safely run automatically.  (That is exactly how it
landed in round 11: waste-over-half thresholds with small floors, no
new API.)  **Slot compaction**
moves live elements, is metered by dead-slot ratio, and carries all the
policy weight: outstanding refs (plain `{group, slot, gen}` objects in
user-held collections, plus packed-int membership-set caches — they
cannot be found and rewritten eagerly), z-order (slot order is draw
order), GPU full re-upload (the existing `resized` path), and remap of
in-flight animation slot lists.

**Open policy questions** — these apply to the *slot-moving* tier only
(round 11 took the slot-stable lean of (b)); options discussed —
**all three decided with the user 2026-08-01, see the round-19 plan
at the end of this file**: (a) ref
survival across a slot move — a forwarding table with lazy ref repair +
an epoch stamp invalidating cached membership sets (**taken**), vs
handles-survive-collections-stale, vs everything-stale; (b) trigger —
explicit `cy.compact()` vs auto thresholds (**both taken**: auto
threshold + the explicit call); (c) draw order after
compacting — stable
(visually a no-op) (**taken**) vs restore-insertion-order (heals the
recycled-slot
z-order wart at the cost of a visible change and a per-slot sequence
number).

**Settled adjacent question**: removed-element readability is
*orthogonal* to compaction — v4 already gave it up when it chose
tombstones + a free-list (the next add may recycle the slot), and the
round-10 design call above makes that permanent.  Compaction changes
nothing for removed refs under any option: a removed ref matches no
forwarding entry and its generation is already stale, and the cached
`id()`/`group()` live on the JS handle, not in the columns.

## v3 → v4 parity gap analysis (2026-07-28)

A systematic sweep of the **entire v3 public surface**, diffed against
v4.  Sources: the v3 style registry (`src/style/properties.mts` — 280
registered properties + 11 aliases across 21 groups), the docmaker API
index for core and collection (cross-checked against the prototypes),
the v3 renderer's event/gesture emission (`load-listeners.mts`), the
layout and extension registries, and the documented init options —
diffed against `src/gpu/README.md` plus source spot-checks of
`src/gpu/`.  Every gap below is classified into one of four tiers:
**at parity**, **dropped by decided design** (recorded, no action),
**gap with direction set** (build when scheduled), and **needs a
call** (API semantics are never improvised autonomously).  A final
tier lists **proposed drops** — v3 features we suggest *not* porting;
none of those is decided until signed off.

### At parity (verified, no action)

Core viewport/events/data/batching, the whole collection
iteration/comparison/building surface (incl. `eq`/`first`/`last`/
`slice`/`toArray`/`anySame`/`symmetricDifference`/
`closedNeighborhood`), traversal, degree, flags/switches
(incl. `active`/`pannable`), the full v3 algorithm surface, layouts
grid/preset/circle/concentric/breadthfirst/random (+ `eles.layout()`
plumbing), `png`/`jpg` export options, `mount`/`unmount`/`destroy`,
`stop(clearQueue, jumpToEnd)` (since round 21 `stop(jumpToEnd)` — no queue)/`delay`/`delayAnimation`, box selection
with `selectionType`, pinch zoom, the cxttap/dbltap/taphold gesture
set, and `data`/`scratch`/`json()` export.  (Where v3 takes a
selector these take collections/queries/predicates — the decided v4
form, not a gap.)

### Dropped by decided design (recorded in src/gpu/README.md; ledger only)

Selector strings and `cy.$()`; classes; per-element style
bypass/setters (`style(name, value)`, `removeStyle`, `flashClass`);
style functions; CSS-string stylesheets and the
`cytoscape.stylesheet()` builder (follow from the `{ nodes, edges }`
object-sheet decision — worth recording explicitly);
selection-dependent restyling (`:selected` blocks → shader accent
ring); `restore`/`clone`/`copy` and `cy.json()` import; custom easing
functions and `spring(tension, friction)` (→ `spring(bounce)`); event
namespaces; v3 bubble order *within a phase* (registration order
instead; compound bubbling itself landed round 14.5 with v3's
cross-phase order); per-element `font-family`;
viewport-fixed labels; `renderTo`; `cy.notify`/`notifications`/
`noNotifications` (dirty-driven renderer).  Added by the 2026-07-29
triage (below): the canvas-era perf degradation options
(`hideEdgesOnViewport`, `textureOnViewport` + `outside-texture-bg-*`,
`motionBlur`/`motionBlurOpacity` — obsolete under compute culling +
adaptive render scale); `background-blacken` (subsumed by color
mappers); `bounds-expansion` (bounds are computed correctly instead);
and the legacy aliases (`content`, `padding-{left,right,top,bottom}`,
no-dash shape spellings, redundant `attr`-family duplicates — one name
per concept), **less two recorded exceptions**: `autolockNodes` and
`autoungrabifyNodes` are kept (fifth design sitting, 2026-08-04).

**The legacy-alias line was not true of the code** (found 2026-08-03 by
the round-29 docs check, and left as a call rather than patched):
`cy.autolockNodes()` and `cy.autoungrabifyNodes()` were declared, wired
and working, and round 29.1's alias table *pinned* them; the no-dash
shape spelling `roundrectangle` likewise still compiled, where
`cutrectangle` and `concavehexagon` threw.  So the 2026-07-29 triage
was applied unevenly and three names survived it.  It was one call, not
three — "does the one-name-per-concept rule actually apply to these?" —
and the fifth design sitting **split** it (executed as round 37.2):
`roundrectangle` drops and throws with its siblings, from all three
enums that took it; the two core aliases stay, as exceptions written
into the ledger line above rather than left as drift.  The line the
call had to change was the `roundrectangle` one in
`test/gpu-decided-drops.mjs`, which now pins the drop; the alias table
in `test/gpu-aliases.mjs` keeps its two rows, with the reason.
`content` and `padding-{left,…}` *do* throw, as does every other prop
in this ledger — pinned since 29.3 by `test/gpu-decided-drops.mjs`.

### Gaps with direction already set (build when scheduled)

- **Curved edges** — the single biggest *visual* gap.  **Pass 12a
  (bundled `bezier` + self-loops) landed 2026-07-30**, and **pass 12b
  (`unbundled-bezier`, `segments`, `round-segments`, `taxi`,
  `round-taxi`) landed 2026-07-30/31** — see the round records.
  ~~Still open from v3's `curve-style`: `haystack` and
  `straight-triangle` plus manual endpoints (the 12c pass).~~ —
  **12c landed 2026-07-30/31**, completing the family.
  Brings with it: **self-loops** (`loop-direction`/`loop-sweep` — a
  loop currently degenerates to a point in v4), `control-point-*`,
  `segment-*`, `taxi-*`, `radius-type`, `edge-distances`,
  `source/target-endpoint`, `source/target-distance-from-node`, and
  the accessors `controlPoints`/`segmentPoints`/
  `renderedControlPoints`/`isBundledBezier`.  Design tier decided
  (2026-07-24): dual CPU/WGSL impls, conservative CPU bound for
  cull/fit, exact lazy `.bb()`, membership as a structural index.
  The 2026-07-29 triage added `curve-style: haystack`
  (+ `haystack-radius`) and `straight-triangle` to this surface: kept
  as *real visual styles* (offset-endpoint and triangle-shaped edges),
  not perf modes — v4's culling makes the perf rationale moot but the
  looks stay.
- ~~**Ghost props**~~ — **landed as round 13 A1** (2026-07-31).  Kept in
  the 2026-07-29 triage (SBGN needs them), in a simplified form: a
  ghost duplicates only the basic node body — shape, border,
  background — at the offset, an extra instance draw, never a
  whole-cloth redraw of the full node (labels and other decorations
  excluded).
- ~~**Overlay/underlay theming**~~ — **landed as round 13 A2**
  (2026-07-31), core props included.  The 2026-07-29 triage decided to
  *port the props* (the 10 overlay/underlay element style props plus
  the `active-bg-*` and `selection-box-*` core options) rather than
  keep the affordances baked in; the existing shader hover/active
  brighten, accent ring and DOM selection box become the styled
  defaults.
- ~~**Multiline labels**~~ — **landed as round 16** (2026-08-01),
  along with label bounding boxes.  `text-wrap`/`text-max-width`/
  `text-justification`/`line-height`/`text-overflow-wrap` (+
  `ellipsis`), on the decided tier (shaping memoizes; model-space
  keeps it zoom-invariant).
- ~~**Edge label autorotate** (`text-rotation: autorotate`)~~ —
  **landed 2026-07-29** (see the autorotate entry below); the flip
  rule call was taken as v3's verbatim undirected-slope angle.
  ~~Per-element *numeric* `text-rotation` stays in the label-parity
  batch.~~ — **landed as round 27.7** (2026-08-02), on any label.
- ~~**Force-directed layout**~~ — **landed as round 18**
  (2026-08-01): `cy.layout({ name: 'force' })`, spring–electric with a
  CPU reference executor and an on-device integrator under the
  position lease.  The call this entry left open (port cose vs a
  modern kernel) was taken for the latter.
- **Compaction** — slot-stable tier (id blob / CSR / dictionary
  reclaim) **landed in round 11** with auto waste thresholds; ~~the
  slot-moving tier still waits on the logged policy calls~~ — the
  slot-moving tier **landed as round 19** (2026-08-01), policy calls
  and all.
- ~~**z-index**~~ — **dropped outright** (decided 2026-08-01, no round
  at all): draw order is structural and stays that way, so `z-index`,
  `z-compound-depth` and `z-index-compare` are not coming to v4 and
  neither is `zDepth`/`sortByZIndex`.  See the decided-design bullet in
  the README.  The mechanism this entry named (more z-ranks or a `u32`
  index-indirection pass) survives only as the logged single-boolean
  elevated tier, if demand ever appears.

### Needs a call (design open — grouped, with the v3 surface at stake)

*(The still-open items here are collected, with their evidence and
what changes when each is decided, in "Open calls for the maintainer"
near the top of this file — read that first; this ledger keeps the
per-item history.)*

1. ~~**Compound nodes**~~ — **landed as round 14** (2026-07-31; the
   plan and per-item records are at the end of this file): hierarchy
   in the columnar store, auto-sized parents materialized into the
   position/size columns, the parents sheet group + structural
   query/case terms, ancestor-gated visibility + rendered
   effectiveOpacity, ported event bubbling, compound loop edges,
   the parent draw stream, and layout/tween/interaction rules.
   The original scoping notes, for the record: the largest single
   absence.  Style: the
   8-prop compound group + `:parent` visuals + `padding`/
   `padding-relative-to` + `z-compound-depth`/`z-index-compare` +
   `compound-sizing-wrt-labels`.  Collection: `parent`/`ancestors`/
   `children`/`descendants`/`siblings`/`orphans`/`nonorphans`/
   `commonAncestors`/`isParent`/`isChild`/`isChildless`/`isOrphan`,
   `move({ parent })`, `forEachUp/Down`, compound-relative
   `relativePosition`, `effectiveOpacity` semantics, event bubbling
   through parents, cose nesting.  Needs its own design round:
   hierarchy in the columnar store, parent auto-bounds vs cull/bb,
   render order.
2. **Background images** (16 props) — per-node images/icons are
   ubiquitous in real apps (`background-image` + fit/clip/position/
   repeat/opacity/smoothing/crossorigin...).  GPU shape: a texture
   atlas or array keyed per element; interacts with the fixed-atlas
   discipline.  High app value; sizeable renderer feature.  **Landed
   as round 15 (2026-08-01, below): tiered texture arrays + mips,
   SVG zoom-promotion, an SDF icon mode, multi-image parity.**
3. **Pie / stripe backgrounds** (51 + 50 props) — SDF-friendly in
   principle; the call is whether v4 wants them (or a leaner
   generalization) at all.  **Call taken 2026-08-01 (third design
   sitting): yes, as the lean list-valued `chart` family designed
   for future chart kinds — scoped as round 23 (plan at the end of
   this file).**
4. **Node visual parity batch** — gradients
   (`background-fill`/`line-fill` linear/radial + stop props),
   `corner-radius` control, `border-style`/`-cap`/`-join`/
   `-dash-pattern`/`-dash-offset`/`-position`, the node `outline-*`
   group (5), custom
   `polygon` via `shape-polygon-points` (per-element point data),
   and the unported shape keywords (`round-*` family,
   `cut-rectangle`, `barrel`, `concave-hexagon`, `right-rhomboid`,
   `bottom-round-rectangle`).  Each is small-to-medium; needs a
   scope call on which subset earns its shader/channel cost.
   (`background-blacken` and `bounds-expansion` were in this batch
   until the 2026-07-29 triage dropped them.)  **Landed as round 13
   (2026-07-31, B/C series)**: gradients, corner-radius,
   border-position, dash pattern/offset/cap, the outline group, the
   custom polygon.  **The shape keywords landed as round 27**
   (2026-08-02): the two plain-polygon ones as point tables,
   `cut-rectangle`/`bottom-round-rectangle`/`barrel` as
   parameterized fields, and the seven `round-*` keywords as
   `sdPolygon( inward-offset ) − r` — the identity that makes
   corner-rounding exact under anisotropic scaling, which is what
   the earlier "no clean closed form" note had missed.  **v3's
   node-shape vocabulary is complete.**  Still open:
   `border-style`/`outline-style`, held for exactly the scope call
   this item's own sentence above asks for — see the round-27.8
   entry for the three cost tiers.  (Call taken 2026-08-04: **full
   coverage** — scoped as round 38.)
5. **Arrow parity** — `mid-source`/`mid-target` positions,
   `arrow-fill: hollow`, `arrow-width`, `arrow-scale`, compound
   shapes (`triangle-tee`/`circle-triangle`/`triangle-cross`/
   `triangle-backcurve`).  Mid-arrows are cheap on straight edges
   but really belong with curved-edge midpoint math.  **Landed as
   round 13 (2026-07-31, B7/C1)**: arrow-scale, per-end
   fill/width, mid-arrows on the curve/route midpoint.
   **Closed by round 27** (2026-08-02): the four compound heads
   landed in 27.6 and v3's nonlinear arrow-size formula in 27.3, so
   **v3's arrow vocabulary is complete** and arrow sizes match v3's
   in every width regime — measured, not asserted, with the live
   parity diff moving 4.459% → 0.013%.  Recorded deviation: a
   hollow compound head falls back to filled.
6. **Label parity** — placement (`text-valign`/`text-halign` grid
   vs v4's fixed below-node), per-element numeric `text-rotation`,
   **source/target edge labels** (10 props — second/third label
   streams), `text-opacity`, `text-transform`,
   `font-style`/`font-weight`, `text-border-*`,
   `text-background-shape`, and per-element `min-zoomed-font-size`
   vs v4's global `labelFadePx`/`labelMinPx`.  **Landed as round 13
   (2026-07-31, B6/D series)**: the halign/valign grid,
   text-opacity/transform/border/background-shape,
   font-style/-weight, per-element min-zoomed-font-size, and the
   source/target label streams.  **Numeric `text-rotation` landed
   as round 27.7** (2026-08-02), on any label, alongside the
   `autorotate` keyword (edge-only — it resolves from an edge's
   slope).  Also: **labels are
   excluded from `boundingBox()`** in v4 — v3's `includeLabels`
   (and the bb options object generally) affects `fit()` semantics;
   the conservative-label-bound design (already sketched for
   multiline) is the likely answer.  **Landed as round 16
   (2026-08-01, below): the wrap family, and labels join bb/fit by
   default with { includeLabels } opt-out.**
7. **Event vocabulary** — v4 lacks the element state events
   (`grab`/`grabon`/`drag`/`free`/`freeon`/`dragfree`/
   `dragfreeon`), the normalized device events (`tapstart`/
   `tapdrag`/`tapend` + `vmouse*` aliases, raw `mousedown`/
   `mousemove`/`mouseup`/`click`), `tapdragover`/`tapdragout`
   hover-during-drag, `cxtdragover`/`cxtdragout`,
   `tapselect`/`tapunselect`, and the viewport-gesture variants
   (`dragpan`/`scrollzoom`/`pinchzoom`).  Event objects also lack
   `preventDefault`/`stopPropagation` and bubbling semantics.
   Mostly cheap plumbing, but every name is permanent API — one
   deliberate call on the v4 event vocabulary is better than
   accretion.  **Landed as round 17 (2026-08-01, below): the curated
   set plus the official pointer-event family.**
8. **Interaction options + touch parity** — `wheelSensitivity`,
   `touchTapThreshold`/`desktopTapThreshold`, configurable taphold
   duration, `pixelRatio`, per-element `events`/`text-events`
   (pointer-transparency), `box-selection: overlap` mode (v4 is
   'contain' only), two-finger cxttap on touch, and the
   three-finger box gesture (currently listed as not implemented).
   **Scoped as round 20 (2026-08-01, plan at the end of this
   file)**: the option quartet + `events`/`text-events` + both
   touch gestures; `pixelRatio` found already landed; the overlap
   box mode deferred as a demand-gated hook (not v3 surface).
9. **Animation surface** — `step` callback, `queue: false`,
   `renderedPosition` targets, Animation object controls
   (`pause`/`progress`/`reverse`/`apply`/`applying`/`completed` —
   v4's handle has `play`/`stop`/`promise`), and **style
   transitions** (`transition-property`/`-duration`/`-delay`/
   `-timing-function`): call whether transitions return as sugar
   over the animation system or stay out.  **Partially resolved
   2026-08-01 (third design sitting): v4 animations need not match
   v3 — the queue is dropped outright (round 21) and `step` stays
   out; controls and transitions remain the open follow-up.**
   **Remainder scoped 2026-08-01 (fourth design sitting) as round
   24 (plan at the end of this file): transitions return with a
   v4-specific trigger taxonomy + the domain perf contract, and
   `pause`/`resume`/`reverse` land (`progress` stays a getter,
   `apply`/`applying` stay out).  Round 24 landed in full the same
   day — item closed; the geometry tween (size-channel transitions
   + animation, one benchmarked round) was the successor follow-up,
   built as round 25 (2026-08-02) — also closed.**
10. **Extension system** — `cytoscape.use()` and
    `cytoscape(type, name, registrant)` registration for
    layout/renderer/core/collection extensions.  v4 has none; this
    gates the entire external ecosystem (fcose, dagre, elk, cola,
    edgehandles, ...).  At minimum a v4 **layout extension
    contract** needs designing; core/collection extension points are
    a separate call.  **The layout contract landed as round 17
    (2026-08-01, below): direct objects, no registry;
    core/collection extension points stay deferred (recorded).**
11. **`display` vs `visibility`** — v3 distinguishes `display: none`
    (no space) from `visibility: hidden` (occupies space) from
    zero opacity; v4 has one `show`/`hide` flag.  Call: is one flag
    enough, and what do `visible()`/`takesUpSpace()` mean exactly.
    **Resolved 2026-08-01 (third design sitting): both tiers exist
    — show/hide stays the display tier (now re-fanning bezier
    bundles, v3's structural semantics), `visibility` lands as a
    mapper-capable style prop keeping space and bundle ranks —
    scoped as round 22 (plan at the end of this file).**
12. **Odds and ends** — trued up 2026-08-03 (round 28.3), because
    three of the six entries had stopped being true:
    - ~~`cy.window()`~~ — **exists** (`core.mts`, with a "v3 parity"
      doc comment).  It was listed as a gap it had already closed.
    - ~~`panBy` animation target~~ — **landed as round 28.2**
      (2026-08-03).
    - ~~layout instances as event emitters~~ — **not a gap but a
      decision**: round 17 settled that lifecycle events fire on the
      core exactly once per run and layout instances stay
      non-emitters (recorded in the README's extension-contract
      section).  It belongs in the decided-design ledger, not here.
    Genuinely open, each needing a call rather than an
    implementation:
    - **`cy.gc()`** — v3's manual garbage-collect hook.  Round 19 gave
      v4 `cy.compact()` plus an automatic trigger, so the question is
      whether `gc` survives as anything but an alias.
    - **`cytoscape.warnings()`** — the global console-warning toggle.
      v4 warns in several places (a deferred `compact()`, a full glyph
      atlas), so there is something to silence; whether a global
      mutable switch is the v4 spelling is the call.
    - **graph-level `data` in the wire format** — narrower than it
      reads: `cy.json()` **already exports** it (`core.mts`), and the
      gap is the *binary* format (`serializeElements`), which carries
      elements only.  Since `cy.serialize()` output feeds `cy.add()`,
      including graph data raises whether adding elements should
      overwrite the target's `data()` — a semantics call, not an
      omission to patch.

### Proposed-drops triage (decided 2026-07-29)

The proposed-drops list was triaged with the user in one sitting;
every entry now has a decision.

- **Dropped** (added to the decided-design ledger above):
  - **Canvas-era performance hacks** — `hideEdgesOnViewport`,
    `textureOnViewport` (+ `outside-texture-bg-*`), `motionBlur`/
    `motionBlurOpacity`.  Obsolete under WebGPU + compute culling +
    adaptive render scale, which solve the same problem without
    degrading interaction.
  - **`background-blacken`** — subsumed by color mappers (compute the
    shade in the mapper range instead).
  - **`bounds-expansion`** — a manual bb-correction escape hatch;
    unnecessary when bounds are computed correctly.
  - **Legacy aliases** — `content`, `autolockNodes`/
    `autoungrabifyNodes`, `padding-{left,right,top,bottom}`, the
    no-dash shape spellings (`roundrectangle` etc.), `attr`-family
    duplicates beyond the ones already kept.  One name per concept.
- **Kept** (moved to "gaps with direction set" above):
  - **`curve-style: haystack` (+ `haystack-radius`) and
    `straight-triangle`** — ported as *real visual styles*, not perf
    modes, alongside the curved-edge work.
  - **Ghost props** (`ghost`/`ghost-offset-*`/`ghost-opacity`) —
    needed for SBGN, kept with simplified scope: the ghost duplicates
    only the basic node body (shape, border, background) at the
    offset — an extra draw, but simple — never a whole-cloth redraw
    of the full node (labels and other decorations excluded).
  - **Overlay/underlay as style props** (10 props + `active-bg-*` +
    `selection-box-*` core props) — port the props; the baked-in
    affordances (shader hover/active brighten, accent ring, DOM
    selection box) become the styled defaults.
- **Deferred into the multiline/label-bb round** (the listed lean,
  now decided): **`text-metrics`**, **`box-select-labels`** — their
  v4 form is designed there; neither ported as-is nor dropped now.

### Suggested sequencing (unchanged by the sweep, now grounded in it)

The sweep confirms the two headline pillars — **curved edges** and
**compounds** — dwarf everything else in app impact, with
**background images** the sleeper third (16 props, near-universal in
production apps).  Of the near-term autonomous work, slot-stable
compaction landed as round 11 and edge-label autorotate landed
2026-07-29 — the autonomous shelf is clear.  The
design queue, in suggested order: curved
edges (12a — bundled bezier + self-loops — landed 2026-07-30 and 12b —
unbundled/segments/taxi — 2026-07-30/31; 12c endpoints +
haystack/straight-triangle remains; since complete) → compounds
(landed as round 14, 2026-07-31) → background images + the
node-visual scope call
(ghost's simplified body-duplicate form slots in here) → the event
vocabulary + extension contract calls (cheap to build once decided,
and they unblock the ecosystem) → force layout.  Overlay/underlay
theming props ride with the interaction/visual batches.  The
proposed-drops list was triaged 2026-07-29 (see the section above):
four entries dropped into the decided-design ledger, three kept with
direction, and `text-metrics`/`box-select-labels` folded into the
label-bb round.

**2026-08-01 design sitting**: with rounds 12–14 landed, the
remainder of the queue was scoped in one sitting (plans at the end
of this file): **z-index dropped outright** (decided design, no
round at all) → background images (round 15) → multiline labels +
label bb (round 16) → event vocabulary + extension contract
(round 17) → GPU force layout (round 18).  **All four rounds landed
in full the same day** — the queue is clear.

**Since then**: round 19 (slot-moving compaction) closed the last
architecture item, round 20 closed gap item 8 (interaction options +
touch parity), and the **third design sitting** (2026-08-01) scoped
and landed rounds 21–23 (animation queue removal, the
display/visibility split, node charts) — see the plans and records
below.  What remains of the needs-a-call list: ~~the animation
controls/transitions follow-up~~ (item 9's open half — **scoped as
round 24 by the fourth design sitting and landed in full the same
day, 2026-08-01**; ~~the geometry-tween round it logged~~ landed as
round 25, 2026-08-02), ~~the small parity remnants noted inline in
items 4–6~~ (**closed by round 27, 2026-08-02** — v3's node-shape and
arrowhead vocabularies are complete and numeric `text-rotation`
landed; the one remainder is `border-style`/`outline-style`, held for
the scope call item 4 itself asks for), and items 8's deferred overlap
box mode, 10's core/collection extension points and 12's odds and
ends.

**2026-08-02, rounds 26–27**: round 26 built the authoring surface —
JSDoc across the whole prototype (46% → 100%, gated) and the first
shipped TypeScript declarations for `cytoscape/gpu` — and round 27
closed the visual-parity tail.  What is left of the whole ledger:
**`border-style`/`outline-style`** (a scope call, 27.8), item 8's
overlap box mode, item 10's core/collection extension points, and
item 12's odds and ends.

**2026-08-03, rounds 28–29.**  Round 28 took the part of that
remainder needing no design call: CPU-pick coverage for round 27's shapes (28.1 — a
verification gap, not an API one), the `panBy` animation target
(28.2), and item 12's own drift (28.3, above).  **What remains of the
ledger is entirely open calls** — decisions, not implementations, and
all of them (plus the contradictions rounds 28–29 found) are collected
in "Open calls for the maintainer" near the top of this file:
`border-style`/`outline-style` (27.8's scope call), the
**legacy-alias policy** (one call over `roundrectangle`,
`autolockNodes` and `autoungrabifyNodes` — all three survived the
2026-07-29 triage that says they were dropped), item 8's overlap box
mode,
item 10's core/collection extension points, and item 12's surviving
three (`cy.gc()`, `cytoscape.warnings()`, graph data in the binary
wire format).  Nothing in the ledger is now blocked on
effort.  **Round 29** then worked a different axis entirely — not the
ledger of what is unbuilt but a survey of what is *unpinned* — and
found the alias surface untested (83 methods whose type declarations
and runtime wiring are separate things), four public methods no spec
mentioned, the decided-design drops enforced only by intention in
three places (a string event qualifier crashed inside the emitter on
the next event; a style *function* group was silently ignored; the
collection methods crashed on `other._refs` or answered false), and
curved edges unpriced on the CPU.  It also closed 27.9 by measuring on
the RX 580: round 27's shader branches cost nothing per frame.  (This
paragraph ended with a sentence calling that measurement "open and
blocked on neither — just unrun" *after* 29.5 had run it — written
during the round and left standing by 29.6's own sweep.  Removed in
30.5, and noted here because it is the third round running that this
summary has been the thing that drifted.)

**2026-08-03, rounds 30–32.**  Continuing round 29's axis onto the part of
the surface v4 states most and tests least — **what it throws**.
Measured with source-mapped coverage: 34 of the 191 throw sites in
`src/gpu` had never executed.  30.1 closed every Node-reachable one
(20 specs, one of whose controls came back BAD and forced a sharper
spec), 30.2 pinned the six export guards in the browser project, 30.3
took the untested public surface the survey turned up beside them
(`cy.stop()`, `renderedTargetEndpoint`, two clustering metrics), and
30.4 shipped the measurement as `scripts/gpu-throw-coverage.mjs` —
reporting only, since a coverage floor is a call, now logged as open
call 8.  Reading at the close: 176 run, 13 browser-only, 2
unreachable by design, **0 Node-reachable and never run**.
**Round 31** then asked what those throws *say*: it found the
per-element bypass error advising the style function form — removed in
round 8, throwing since 29.3 — fixed the message and its doc comment,
took `@throws` on public throwing members from 7/16 to 16/16 under a
gate, and covered `mouseout`/`pointercancel`, the last two names of
the round-17 event vocabulary no test mentioned.  Its lesson is about
sweeps rather than about errors: the markdown had been right all
along, and the wrong text was in a runtime string and a JSDoc block.
**Round 32** finished the contract sentence's remaining clause —
`@param` on every public member that takes arguments (143 → 221 of
221, gated) — with the boundary drawn by docmaker's own shape:
arguments carry a description the generator emits, returns do not, so
the `@returns` tail (63 of 276) is measured and logged rather than
built.

**2026-08-03, round 33.**  The benchmark sweep, on the user's scope
call: benchmark everything possible, core through renderer.  Fourteen
suites became twenty-two; the surfaces that had *no* measurement at all
— layouts, four algorithms, the style engine's apply and readback paths,
loading and the wire format, picking/box-selection/bounds, the data
sidecar and structured queries, events and the animation lifecycle,
store internals, images and charts — now have one, plus a 117-row
breadth pass over the rest of the public API and a third audit script
reporting which members a benchmark calls.  Open call 7 closed with it.
The round's most useful output is not the wins (they were mostly where
earlier rounds said) but the **five places v4 is slower than v3 or
slower than its own design implies** — the style getters at 13–21×
(*5.8× on re-measurement through the bundle; see round 34.0*), the
compound emit path never taking the no-listener fast path, the layout
contract's per-run whole-graph materialization, `mutableElements()` and
`indexOf()` — each measured, localized and logged rather than fixed,
because a measurement round measures.  Six rows across the round were
**caught measuring nothing** by design call 5 and rewritten, and one of
those (`curves.mjs`'s box-selection premium) had been published in the
README since round 29.4.

**2026-08-04, round 36.**  The completion round: after 35, what remained
in this file was the twelve open calls plus a short tail that needed no
decision at all, and this round is that tail and only that.  `@returns`
went from round 32's measured-and-deferred 63-of-276 to **276/276**,
written but deliberately **not** gated — round 32's boundary (docmaker
emits a description per argument and has no return field) is where the
gate stays.  Writing it turned up that the `@param` gate had never
walked the public tier's *exported functions*, so `wire.mts` and
`columnar.mts` sat outside an audit reporting 221/221; now 229/229.  The
browser-only throw tier, opened by round 30 and half-closed by 30.2's
six export guards, is finished — **four specs and three honest
reclassifications**, since three of the seven are guards no input
reaches (one of them shadowed by a synchronous check twenty-five lines
above it).  Two public collection members no benchmark had ever called
got rows, chosen so they *walk* rather than short-circuit.  And three
measurements this file had promised and never taken were taken:
`--layout` on the RX 580, the wall time of each report profile (quick
7.1 min, `--all` 17.4), and a re-runnable source for rounds 34–35's
bundle figures, which reproduced round 35's numbers and refined one —
the post-table spread is two populations, and the upper one is colour
*formatting* rather than dispatch.
The round's own finding is a **stranded-doc-block check**.  The defect
— a later insertion landing between a doc block and its member — has
happened eleven times here, and the coverage gate catches it only when
the displacement leaves some member bare; when it lands on another
documented member, coverage stays 100% and two members carry each
other's prose.  The check found **six more on its first run**, and one
of them was shipping in `dist/cytoscape-gpu.d.ts`.  It reports rather
than gates, because the third shape of the defect — a block displaced
onto a different documented member — is not statically detectable at
all, and because it cannot tell a deliberately free-standing note from
a displaced block.

**2026-08-03, round 35.**  The maintainer read round 34's residual —
"the style getters are still 2.3× and the cause is a 145-case switch" —
and asked the obvious question: why is a 145-case switch there at all,
and why not a direct lookup?  Both halves were right.  The count is not
accidental (one entry per readable property, median two lines each), but
the *shape* cost something real: V8 does not hash a string switch that
large, so a property's read cost depended on its position in the file —
which is also why rounds 33 and 34 understated the getters, having
measured `background-color`, the fourth case.  Round 35 turned the
switch into a `Map` of 111 readers behind a 153-property
characterization spec, flattening the spread from 5.1× to 2.3× and
making a whole-object `style()` 1.27–1.48× faster.  The lesson worth
keeping is not about switches: **the round happened because someone
asked why a number was shaped that way, after the measurement rounds
had accepted it.**

**2026-08-03, round 34.**  The fix round for what 33 measured.  All five
paths are fixed — `indexOf` and `mutableElements()` at parity with v3,
the emit path's new no-listener gate at 8 ns, the layout contract 420×
cheaper per run, the style getters 5.8× → 2.3× — with no behaviour
change and no pixels moved (168/168 browser specs, goldens byte-stable).
Two of the five findings were **corrected while being fixed**: the style
gap was inflated by tsx's `__name` wrapper (the benchmark suites import
`src/`, and for a closure-heavy hot path that measures the transpiler),
and the row round 33 cited for the emit finding never reached the emit
path at all — it was measuring compound auto-bounds invalidation.  The
transferable rule is now in `AGENTS.md`: **check a hot-path finding
against the built bundle before rewriting anything**, since the planned
`readProp` fix turned out to be a no-op in production and the real cost
was `normalizeProp` doing a regex replace per read.
What is left of the five is a **residual 2.3× on the style getters**,
which is no longer a hot spot with an obvious cause — it is the
145-case switch and the guard lookups that precede it.  Not logged as an
open call: it needs no decision, only appetite.

**2026-08-04, the fifth design sitting — the production-readiness
roadmap.**  With round 36 done, everything left in this file was open
calls, and the sitting took all of them (the per-item records are in
"Open calls for the maintainer" above).  What follows from the answers
is **rounds 37–50**, planned at the end of this file: the governance
close-out (37 — the two new gates, the alias split, the strictness
closures), the full `border-style`/`outline-style` port (38), the
decided feature tail — overlap box mode, wire graph-data, `cy.gc()` —
(39), the error-policy sitting + `cytoscape.warnings()` (40 — the one
question the sitting deliberately left open), the v4 Event + emitter
(41), the **`v3/` restructure** that makes v4 the package's default
export (42), packaging/publish hardening (43), the JSDoc→docmaker
generator (44), the v4 docs site (45), the migration guide + CHANGELOG
(46), robustness/soak (47), cross-platform validation (48), release
engineering + `4.0.0-alpha.1` (49), and the release bake to **4.0.0**
(50).  This sitting's edit touches PLAN.md only, at the maintainer's
instruction; the README true-up (header, follow-up hooks) lands with
round 37's docs-first commit — noted so the standing docs-travel rule's
exception is on the record rather than silent drift.  "Gaps with
direction already set" was checked by name and needed nothing (its
entries all closed by earlier rounds).

**2026-08-04, round 41 — the v4 Event and emitter.**  Taken out of order
(38 is waiting on the sub-calls above, 40 is a sitting), and worth it: it
is round 42's precondition and it closed the last of the round-26.5
logged items.  v4 now owns its event object and its emitter, `event.target`
is typed, `originalEvent` is populated, and the namespace parsing v4 had
been *inheriting while its design disclaimed it* is gone.
Two of the round's own premises were wrong, both stated as facts about
code nobody had re-measured — see the round record.  The emitter was not
v4's only outward import (five utility modules remain, now audited by a
spec instead of asserted by a sentence), and `preventDefault()`'s gesture
half could not be enumerated "from v3-source reading" because v3 never
reads the flag either.  The DOM half landed; the enumeration is open call
12.  That is three rounds in a row — 37.3, 37.4, 41 — that tripped on a
stale claim in this file, which is now a standing note in `AGENTS.md`.
The emitter swap itself is behaviour-neutral by measurement rather than
by intent: the whole Node suite passed unchanged except the one spec
round 37.4 had written to pin the behaviour this round removes.

**2026-08-04, round 39 — the decided feature tail.**  Three independent
small builds, all decided at the fifth sitting and none needing a new
call: overlap box selection (39.1), graph-level data on the binary wire
(39.2), and `cy.gc()` (39.3).  Round 38 is deliberately **not** what
followed 37: scoping it found three sub-calls the sitting had not
reached (v3's `double` *erases* a stripe rather than drawing a second
band; `dashed` borders need `border-dash-pattern`/`-offset`, which v4
has for edges and not for nodes; `border-cap`/`-join` have no v4
counterpart), which are logged in open-call 1 as that round's
docs-first agenda rather than guessed at inside it.
What 39 is worth remembering for is its **verification**, not its code.
Every overlap spec passed on the first run with the exact flattened walk
deliberately removed — the conservative bb reject was answering every
one of them — so three of them were measuring nothing until two
"band inside the bb that the path does not reach" specs were added.  The
benchmark had the same disease one layer along: its curved row used
`curve-style: bezier`, which bundles multi-edges only, so a fixture with
no parallel pairs priced straight edges under a curved label.  Both are
`AGENTS.md`'s standing rule arriving in a round that had already read
it, which is the argument for running the control rather than trusting
the reading.
And the round-37.1 gate fired **twice, correctly**: edits to
`graph-store.mts` and to `wire.mts`'s header comment moved two
`UNREACHABLE` entries out from under their `file:line` keys, and the
build failed naming them.  That is exactly the failure 37.1 was built
for, arriving in the very next round.

**2026-08-04, round 37 — the governance close-out.**  The first of the
sitting's rounds, and deliberately the smallest, because its gates
protect every round after it.  Throw coverage and `@returns` now gate
(37.1), with the classification allowlists checked rather than merely
written — a zero-tolerance gate is only as good as its escape hatch,
and this one is keyed by `file:line`.  The 2026-07-29 alias triage is
finally applied as decided (37.2): `roundrectangle` drops from all
three enums that took it, `autolockNodes`/`autoungrabifyNodes` stay as
recorded exceptions, and both documents' ledger lines say so.
Constructor strictness closed at the type layer (37.3) and event-name
openness documented (37.4).
Two of the five items **corrected this file rather than executing it**,
which is the round's real character.  37.3 set out to write a
compile-only test and found that `src/gpu/index.mts` — the package
entry point, listed in `PUBLIC_API` since round 26 — contributed *zero*
members to every audit, because the exported-function pattern did not
spell `export default function`; all three of its tags were missing
behind a green gate.  That is round 32's blind spot and round 36's
widening arriving a **third** time, and it says something about audits
that "an audit's scope is part of its claim" has now had to be learned
once per round that touches one.  37.4 set out to document the event
contract and found the namespace record wrong: v4 imports v3's emitter,
so namespaces work in full v3 semantics — what is true is only that v4
never emits a *qualified* name.  Both corrections land in the documents
and in round 41's plan, which had described removing dead machinery.

## Round 12 plan — curved edges (planned 2026-07-29)

The head of the design queue: v4 renders `curve-style: straight` only,
and the curve families are the single biggest visual gap — bundled
bezier is v3's *default* look, and a self-loop currently degenerates
to a point in v4 (a standing correctness wart, not just a missing
style).  The design tier was decided 2026-07-24 (the expensive-GPU-
geometry model): **dual CPU/WGSL implementations that agree by
construction** — never one side reading back the other — with a
**conservative CPU over-approximation for cull/fit**, **exact lazy
CPU eval memoized per element for public `.bb()`**, and bundle
*membership* as a cheap CPU structural index rebuilt on edge
add/remove/move, not per frame.  The 2026-07-29 triage added
`haystack` (+ `haystack-radius`) and `straight-triangle` to this
surface as real visual styles.  This section slices the work into
passes and records the implementation calls so the passes can run
under the round-10 process rules (isolated commits, docs in-commit,
full verify per item, escalation on any real API call discovered
mid-implementation).

**Implementation calls (made at planning):**

- **Geometry ports v3's math verbatim.**  Control points, loop
  construction, segment/taxi routing and endpoint math come from the
  same formulas v3 uses (`src/extensions/renderer/base/coord-ele-math/
  edge-control-points.mts` — the step-size stagger for bundles, the
  loop-direction/sweep construction, the distance/weight frame for
  unbundled beziers and segments, the taxi turn logic), so curves are
  pixel-comparable in the live v3-parity harness and existing figures
  reproduce.  No silent simplifications: any spot where v3's math
  can't ride the GPU path becomes its own logged call.
- **Curves evaluate in the vertex stage from live endpoint positions
  plus per-edge curve parameters.**  Rendered curves are instanced
  segment strips — K quads per edge instead of 1 — whose VS computes
  the curve point analytically from the two endpoint positions (the
  same buffer straight edges already fetch) and a small per-edge
  parameter record (curve kind, bundle offset, loop angles, segment/
  taxi params).  The parameters are position-independent (offsets and
  weights in the endpoint-relative frame), so drags, layouts and
  position tweens follow on-GPU with **zero rebuild**, exactly like
  straight edges, arrows and edge labels today.  Variable-length
  params (segment lists) live in a param blob + per-edge offset
  column — the one storage-layout addition.  K is fixed per curve
  family (bezier/loops subdivide; segments/taxi are exact polylines,
  K = their true segment count), with a far-zoom LOD reduction as a
  tune knob resolved by goldens + the renderer benchmark during 12a —
  not an API surface.
- **One flattening, every consumer.**  The CPU twin evaluates the
  same closed forms: exact lazy `.bb()` (memoized, invalidated by the
  same dirty channels that invalidate the render), CPU pick against
  the flattened polyline at the same subdivision the shader draws (so
  pick agrees with pixels by construction; the GPU pick tile draws
  the same segment strips for the edge stages), and cull/fit read the
  conservative bound — endpoint hull expanded by the maximum control
  offset (bundle stagger, loop extent, segment/taxi excursion) — per
  the decided tier.  Arrows sit on the endpoint node's boundary along
  the curve's **end tangent**; edge labels anchor at the curve
  midpoint (t = 0.5) computed in the VS, so autorotate's angle
  generalizes from the endpoint delta to the midpoint tangent.
- **Box selection keeps endpoint-center containment in 12a** (the
  existing straight-edge approximation, already a recorded
  deviation); upgrading `refsInBox` is revisited with 12b when the
  CPU evaluator covers every family.  (Since done: 12b's revisit took
  v3's exact rule — curved edges test their *curve boundary
  endpoints*, which is what v3's 'contain' actually checks, rather
  than the flattened polyline; straight edges keep centers.)

**Pass split** (each pass lands as isolated commits with Node
geometry tests pinned against v3's math, a golden scene per family, a
live v3-parity scene under the standard tolerance bound, and a
follows-drag/tween Playwright spec pinning the zero-rebuild property):

- **12a — bundled bezier + self-loops** (landed 2026-07-30 — see the
  round 12a record; the default v3 look, and the loop fix): `curve-style` prop (`straight` | `bezier`),
  `control-point-step-size`, `control-point-weight`, `loop-direction`,
  `loop-sweep`; the parallel-edge bundle membership index (keyed on
  the unordered endpoint pair, incremental on add/remove/`move()`);
  the curve-params column + VS quadratic-bezier eval for render and
  pick tile; arrows on end tangents; edge labels at the curve
  midpoint; conservative bound into cull/fit/`boundingBox`; exact
  lazy `.bb()`; `isBundledBezier`/`controlPoints`/
  `renderedControlPoints` accessors.
- **12b — unbundled-bezier + segments + taxi (+ round variants)**
  (landed 2026-07-30/31 — see the round 12b record):
  `control-point-distances`/`-weights`, `edge-distances`,
  `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `round-segments` corner arcs, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`, `round-taxi` radius; the param-blob
  storage for variable-length lists; `segmentPoints`.
- **12c — endpoints + the triage keeps**: `source/target-endpoint`
  (keyword/percent/coordinate forms),
  `source/target-distance-from-node`; `haystack` (+
  `haystack-radius`) as hash-stable intra-node endpoint offsets (the
  decimation trick's determinism, applied to endpoints);
  `straight-triangle`.  Mid-arrows (`mid-source`/`mid-target`,
  `arrow-scale`, `arrow-fill: hollow`, compound arrow shapes) stay in
  the arrow-parity needs-a-call batch — not pulled in here.

Perf: the renderer benchmark gains a curved variant of the pan
scenes (expected cost is ~K× edge vertex work, bounded by cull and
decimation; record the numbers in the round record).

**Open calls — both signed off 2026-07-30** (as the leans):

1. **v4's default `curve-style` is `straight`** — the perf-first
   default at v4's target scales; parity scenes and apps opt into
   `bezier` explicitly.  A deliberate divergence from v3's
   bundled-bezier default, recorded in `src/gpu/README.md`.
2. **`bezier` bundles multi-edges only, verbatim v3**: a lone edge
   between two nodes stays a straight line under `curve-style:
   bezier`; only parallel edges fan out (the odd-bundle middle edge
   is straight too, v3's rule).  Pixel-comparable in the live
   v3-parity harness.

## Landed (round 12a — bundled bezier + self-loops, 2026-07-30)

Ran under the round-10 process rules (isolated commits, docs
in-commit, full verify per item, escalation on real API calls).  Items
landed in CPU-first order; each entry below was written in the commit
that landed it.  (Since superseded: pass 12b — unbundled/segments/taxi
— landed 2026-07-30/31, see its round record; pass 12c — endpoints +
haystack/straight-triangle — remains in the round-12 plan above.)

- [x] **Curve geometry module + contract columns.**
  `src/gpu/curve-geometry.mts` is the CPU half of the dual-impl
  discipline for curves: v3's math ported verbatim (bundle stagger
  `(0.5 − n/2 + i)·step`, loop rays `loopDir − π/2 ∓ sweep/2` at radius
  `1.4·step·(j/3 + 1)`, the `edge-distances: intersection` frame with
  the impossible-bezier clamp, endpoints on the node boundary toward
  the near control point, the loop's two C1-continuous quadratics
  through the control midpoint), with node boundaries at the arrow
  shader's approximation tier (ellipse/rect exact, round-rect as box,
  polygon as inscribed ellipse — recorded deviation).  Also:
  `curvePointAt`/`flattenCurve` (the drawn subdivision, CURVE_SEGS =
  24) and the conservative `curveDeviation` hull bound for cull/fit.
  Contract: `edge.curveParams` column (f32×4; kind packed at [3] so
  the curve shaders fit the vertex stage's 8-storage-buffer budget)
  + `CURVE_*` kinds + the store-managed `FLAG_CURVED` bit the cull
  kernels will split the edge streams on.  17 Node specs pin the port
  against hand-derived v3 values (incl. the antiparallel-edge
  world-invariance of the stagger sign and the C1 loop join).
- [x] **Curve style props + bundle index + param derivation.**  Five
  edge props (`curve-style` straight|bezier, `control-point-step-size`,
  `control-point-weight`, `loop-direction`, `loop-sweep` — v3 defaults;
  angles take numbers-as-radians or deg/rad strings, constants and
  mappers alike, stored-truth readback off the styled record, nodes
  group throws).  `store/curve-index.mts` owns the styled records and
  derives `edge.curveParams`: a lazily-built parallel-edge pair map
  (straight-only graphs pay nothing but a loop check per edge add),
  always-maintained per-node loop lists, and pending-pair lazy flush
  (takeDelta / boundingBox / accessor reads) so a bulk load or style
  apply derives each pair once.  v3 rules pinned: 2-bundle ±step/2
  stagger, odd-middle straight, lone-bezier straight, per-edge step,
  antiparallel sign flip, loop j-stagger per (direction, sweep), and
  re-derivation on add/remove/`move()`/restyle/mapper-refresh.
  `store.boundingBox()` grows its edge term by the conservative hull
  deviation, and `store.curveSlack()` gives the frame-level bound the
  cull kernels will use (monotone maxima — never shrinks, costs only
  cull efficiency).  24 Node specs (`test/gpu-curve-index.mjs`).
- [x] **Curve-aware accessors + the exact lazy edge bb.**
  `isBundledBezier()` (style check, v3 semantics — true for the lone
  edge that renders straight), `controlPoints()` (one point for a
  bundled bezier, two for a loop, undefined for straight — v3's
  surface) + `renderedControlPoints()`; `midpoint()` returns the curve
  midpoint (v3's rs.mid) and `source/targetEndpoint()` return the
  curve's boundary endpoints for curved edges (straight edges keep the
  node-center approximation).  `eles.boundingBox()` reads the **exact
  lazy tier**: `store.curveBBAt()` flattens the curve at the drawn
  subdivision and memoizes per slot against a geometry epoch (any
  geometry write invalidates all cached boxes at once — sound, cheap,
  and consistent with the position-tween lease).  `boundingBoxAt`
  (animated-layout fit targets) expands curved edges by the
  conservative hull deviation.  16 Node specs
  (`test/gpu-curve-accessors.mjs`).
- [x] **Renderer: the curved-edge pipeline, cull stream and pick.**
  `CURVED_EDGE_SHADER` + `CurvedEdgePipeline`: one instance per curved
  edge drawn as a strip of CURVE_SEGS quads whose VS evaluates the
  curve (the WGSL twin of `curve-geometry.mts` — same intersection
  frame, boundary approximations, clamps) from live positions + the
  params column; vertices extrude along the curve normal *at their own
  t*, so adjacent quads share exact edge geometry and the strip is
  watertight without miters.  The vertex stage binds exactly 7 columns
  + the visible list (the base 8-storage-buffer budget); paint columns
  (line color/opacity/line-style) moved to the fragment stage via flat
  instance fetch, and dashes ride a per-vertex polyline arc-length
  varying.  Cull: a new `curvedEdge` kind splits the edge draw on
  FLAG_CURVED (the straight predicate rejects the bit) — same five
  inputs, chord test grown by `frame.curveSlack` (the Frame uniform's
  spare pad slot), no decimation on the curved stream; `CullInfo`
  gained `indexCount` so one scan kernel serves both 6-index quads and
  6×CURVE_SEGS strips.  The pick pass draws the same strips
  (edges-only tile, `pickCull.curved`), so pick coverage equals pixels
  by construction; image export gained the curved group too.  One
  init-order bug found by the specs: the mirror's construction-time
  full upload ran *before* the lazy curve flush whose usual flush
  point (takeDelta) is discarded at init — flush now runs first.
  Verified: 3 new `webgpu` specs (fan-off-the-chord with pixels at
  the CPU-computed `renderedMidpoint` — the dual-impl guarantee made a
  test; ≤64 B re-shape on drag; pick on the bulge vs chord; loops
  render as loops), 2 new goldens (`bezier-bundles`, `self-loops`),
  and a live v3-parity curve scene measuring **0 differing pixels**
  (8px strokes so pixelmatch's AA skip can't mask placement error,
  plus an ink guard) — 59/59 Playwright, 1707 Node, 59 module tests,
  typecheck + lint green; pre-existing goldens byte-identical.
- [x] **Arrows on curve end tangents.**  The insight that made this a
  small change: a quadratic's end tangent points from the control to
  the endpoint, so the curved arrow is *the straight arrow math with
  the control point substituted for the far endpoint* (source end uses
  c1, target end c2 — coincident for a bundled bezier).
  `CURVED_ARROW_SHADER`/`CurvedArrowPipeline` ride the curved cull
  stream's new **single-quad args block** (the scan kernel now writes
  a second `[6, n, 0, 0, 0]` at byte 20 of the indirect buffer, so
  strip streams can also drive one-quad-per-instance draws).  Budget
  cut, recorded: no node-border column fits in the 8-buffer vertex
  stage, so curved-edge arrow tips sit on the size/2 boundary and the
  frame uses border-exclusive halves — exact for the default border 0,
  ≤ border/2 off otherwise (revisit with 12c endpoints).  New
  `curved-arrows` golden (bundle fan converging on the target, an
  antiparallel pair, a loop arrow riding the in-ray tangent); 60/60
  Playwright, 1707 Node, 60 module tests green.
- [x] **Edge labels at the curve midpoint + autorotate tangent.**  The
  edge label VS binds the curve inputs (7 storage buffers + the
  visible list — exactly the vertex-stage budget) and anchors curved
  owners at the curve midpoint computed from live positions, so
  curved-edge labels keep the zero-rebuild property.  Autorotate
  generalizes for free on beziers — a quadratic's t = 0.5 tangent *is*
  the chord direction, so the existing endpoint frame is already exact
  — and loops rotate along their c1→c2 midpoint tangent.  The
  edge-glyph cull (at its own 8-buffer budget, no params binding)
  grows its chord-midpoint test by the frame's curve slack for
  FLAG_CURVED owners; rotated curved labels take a frame-independent
  anchor-centred bound (a loop's rotation frame differs from the
  chord's).  New webgpu spec (glyphs at the CPU-computed
  `renderedMidpoint`, none on the chord, ≤ 64 B re-anchor on drag) +
  `curved-edge-labels` golden (bundle labels per-curve, an autorotated
  boxed label tilted with the chord, a loop label on the loop
  tangent); 62/62 Playwright, 1707 Node, 60 module tests green.
- [x] **Renderer benchmark: the curved pan scene.**  A new
  `gen-25k-curved` scene generates its 50k edges as parallel *pairs*
  (a lone bezier renders straight, so a random-edge scene would
  measure nothing) with `curve-style: bezier` opted into on both
  sides; the runner also gained the platform-gated Linux
  ANGLE-on-Vulkan flags from playwright.config.js — without them it
  silently fell back to SwiftShader (and the software rasterizer then
  lost the device under the curved load).  Same-machine A/B on this
  box (AMD RX 580 / RADV, dpr 2, 1280×800, scale pinned 1), GPU
  device-time p50, straight `gen-25k` vs `gen-25k-curved`:
  continuous-pan fit-all 3.3 → 8.6 ms (~2.6× for 24 quads/edge over
  every edge — well under a 60 fps frame; wall clock stays
  vsync-bound at 16.7 ms on both scenes), zoomed-in 20× 4.4 → 3.8 ms
  (culling keeps the curved stream cheap), far-zoom 1.2 → 6.4 ms —
  the documented no-decimation trade-off on the curved stream showing
  up exactly where expected (revisit with 12c's haystack).  v3 canvas
  ~650 ms/frame fit-all either way (bezier barely moves its cost);
  init 3.0 s v3 vs 169 ms gpu; hover-while-panning pick p50 ~18 ms on
  this box.  Round 12a is complete: props, derivation, accessors,
  exact bb, render, cull, pick, arrows, labels, goldens, parity and
  benchmarks all landed.

## Landed (round 12b — unbundled bezier + segments + taxi, 2026-07-30/31)

Pass 12b of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12b is complete**: props, blob storage, per-edge
derivation, accessors, exact bb, render, cull, pick, arrows, labels,
box selection, goldens, live v3 parity and benchmarks all landed —
final tallies in the goldens/parity entry at the end.

- [x] **`node.outerHalf` derived column — the 12b binding budget.**
  The curved-edge/curved-arrow/edge-label vertex stages all sat at
  WebGPU's base 8-storage-buffer budget after 12a, leaving no slot for
  the variable-length curve **param blob** 12b needs (segment/control
  lists can't fit the fixed f32×4 params column).  The fix is a derived
  column: `node.outerHalf` = size/2 + borderWidth/2 per axis (v3's
  outerWidth/outerHeight frame), written through by the store on every
  node size/border write, never by the style engine.  The four
  boundary-consuming shaders (curved edge, straight + curved arrows,
  edge labels) bind it in place of the size + border pair — one binding
  freed in each — and `GraphStore.curveEvalAt` reads the same column,
  so the CPU twin and the WGSL consume identical f32 half-extents by
  construction.  Two side effects, both improvements: the 12a
  **border-exclusive curved-arrow deviation is gone** (tips sit on the
  border-inclusive outer boundary, like straight arrows — the
  curved-arrows golden uses border 0, so goldens are unchanged), and
  border writes now invalidate the pick-tile cache through the derived
  column's span (`node.borderWidth` itself is pick-neutral, but
  borders move curved pick geometry — a latent 12a gap).  Node specs
  cover the write-through and its dirty span.
- [x] **CPU route geometry** (`curve-geometry.mts`): the CPU half of
  the dual-impl discipline for the three 12b families.  `evalRoute`
  computes the interior route points — unbundled-bezier controls and
  segment points from v3's weighted-frame + perpendicular-offset
  formulas ('intersection' and 'node-position' frames, keeping v3's
  quirk that the normal always comes from the intersection frame), and
  the full verbatim taxi routing (auto/explicit directions, percent/px
  turns incl. negative = from-target, min-distance clamps with the Z-
  and L-shape fallbacks, node-body offsets, the forced-direction
  growth case) — plus boundary endpoints toward the first/last route
  point.  `computeCorner` is v3's `getRoundCorner` as a pure function
  (spec-pinned *directly against* `src/round.mts` output across
  windings, arc- vs influence-radius, limit clamps and collinear
  corners).  The drawn strip stays one indirect draw of CURVE_SEGS
  quads for every family: `quadPiece` maps subdivision indices onto
  route pieces (multibezier: one C1 quadratic per control through
  inserted midpoints; polylines: legs, with corner arcs interleaved
  when round) such that **piece boundaries land exactly on subdivision
  indices** — legs stay pixel-straight and corners exact regardless of
  quad distribution.  That requires pieces ≤ CURVE_SEGS, so interior
  counts are capped (`MAX_MULTI_CTRL` = 8 controls, `MAX_CURVE_PTS` =
  11 segment points — a recorded deviation from v3's unbounded lists;
  derivation clamps with a warning).  `routeMidpoint` ports v3's
  label-anchor/autorotate rules per family (even/odd counts, the round
  arc-apex case with its arc tangent).  Contract: `CURVE_MULTI`/
  `CURVE_SEGMENTS`/`CURVE_TAXI` kinds + `FLAG_CURVED_BOX` (taxi
  routes — and weight-extrapolated routes — are not chord-bounded, so
  kernels without a params binding will cull them against the endpoint
  AABB grown by slack + chord length).  33 Node specs
  (`test/gpu-curve-routes.mjs`).
- [x] **The curve param blob** (`store/curve-blob.mts`).  Blob-backed
  kinds store their variable-length records in one f32 pool the
  renderer mirrors as a storage buffer; the params column holds the
  header `[blobOffset, dev, n, kind]` — no column-layout change, and
  records are position-independent, so drags/layouts/tweens still cost
  zero blob traffic.  Record layouts (multi: mode + d/w pairs;
  segments: mode + round + d/w/r/arc quads; taxi: 8 fixed floats) are
  documented in the module.  Storage behaviour follows the round-11
  slot-stable policy: append allocation with per-slot ranges,
  same-length rewrites in place, freed ranges metered, and automatic
  compaction past waste > half live (256-float floor) — a compaction
  rewrites records in slot order and reports moves so the store
  rewrites the header offsets as normal column spans (geometry
  unchanged, so the bb memo epoch is untouched).  `StoreDelta` gains
  an optional `curveBlob` span/resized entry and `ModelView` exposes
  `curveBlob()`/`curveBlobLength()`; `GraphStore.setCurveParamsBlob`
  writes record + header + FLAG_CURVED/FLAG_CURVED_BOX, feeds the
  monotone dev/box maxima behind `curveSlack()`, and fixed-kind writes
  release any blob record the slot held.  10 Node specs
  (`test/gpu-curve-blob.mjs`).
- [x] **Style props + per-edge derivation.**  `curve-style` gains the
  five 12b keywords; the full prop surface (`control-point-distances`/
  `-weights`, `segment-distances`/`-weights`/`-radii`, `radius-type`,
  `edge-distances`, `taxi-direction`/`taxi-turn`/
  `taxi-turn-min-distance`/`taxi-radius`) parses with v3 defaults,
  list props accepting arrays or space-separated strings, and
  stored-truth readback (lists as space-separated strings, percent
  turns as percent strings).  Scalars/enums are mapper-capable;
  **list props are constants-only** (recorded scope note).
  `edge-distances: 'endpoints'` throws until 12c.  The CurveIndex
  derives blob records **per edge** (the 12b families never bundle):
  v3's min(dists, weights) count rule, last-radius/type repetition,
  the weight clamp to [-1, 2] with out-of-[0, 1] weights marking
  FLAG_CURVED_BOX, taxi always box-bounded, and the interior-count
  caps.  Pair interplay pinned: blob-family members never join nor
  get clobbered by bezier bundle re-derivations, and a blob edge
  restyled to straight resets through the per-slot pending path (the
  pair map is bezier-lazy and may not exist).  Loops: unbundled
  families take `control-point-distances[0]` as the loop distance
  (v3), step-size fallback when unset; segments/taxi loops keep the
  12a all-loops-render-as-loops deviation.  Conservative-bb call
  sites (store scan + `boundingBoxAt`) use the header deviation, with
  box-bounded edges adding the node-half margin (+ chord length for
  extrapolated weights).  26 Node specs
  (`test/gpu-curve-derivation.mjs`); one 12a spec updated (the
  keyword-throw now pins `haystack`).
- [x] **Route accessors + the exact lazy bb.**
  `GraphStore.curveRouteAt` is the route twin of `curveEvalAt` (which
  now correctly returns null for blob kinds instead of misreading
  their headers as bezier params): blob record + live
  positions/outerHalf/shapes → the evaluated `CurveRoute`.  On top of
  it: **`segmentPoints()`/`renderedSegmentPoints()`** (v3's
  getSegmentPoints — defined for segments *and* taxi, whose derived
  routing points read back; undefined otherwise), `controlPoints()`
  extended to the unbundled-bezier control list (segments/taxi stay
  undefined, v3's split), `midpoint()` via the per-family
  `routeMidpoint` rules, `source/targetEndpoint()` as the route's
  boundary endpoints, and `curveBBAt` flattening routes at the drawn
  subdivision into the same epoch-memoized exact-bb cache.  12 Node
  specs (`test/gpu-curve-route-accessors.mjs`) pin hand-derived
  geometry incl. the taxi bb and memo invalidation on moves.
- [x] **Renderer: the route WGSL twin, blob mirror and box cull.**
  `ROUTE_WGSL` mirrors the CPU route evaluator step for step — the
  frame, the full taxi routing, `computeCornerW` (getRoundCorner), the
  piece allocator and `routeVertexW`/`routeMidpointW` — reading the
  same blob the CPU reads, mirrored by ColumnMirror as one storage
  buffer under the usual span/realloc rules (`delta.curveBlob`; a
  realloc bumps `mirror.version`, so bind groups rebuild).  The curved
  edge VS binds the blob as its 7th vertex buffer (back at exactly the
  8-buffer budget) and branches per kind: bezier/loop keep the 12a
  analytic path byte-for-byte (goldens stable), route kinds evaluate
  `routeVertexW` at their subdivision index with **discrete miter
  normals** from the neighbouring indices — exact miters at sharp
  polyline corners (v3's canvas join, extrusion scaled 1/cos(θ/2),
  clamped at 6), chord-normals elsewhere, canonical per index so the
  strip stays watertight; extruding along the miter keeps the
  perpendicular half-width exact, so the FS's AA is unchanged.  Dashes
  keep the chord-sum arc length over the drawn polyline.  The curved
  cull kernel branches on FLAG_CURVED_BOX to the endpoint-AABB test
  grown by slack + chord length (taxi and extrapolated weights are not
  chord-bounded); the edge-glyph cull grows its anchor test the same
  way for box owners.  The pick tile draws the same strips, so pick
  coverage equals pixels for every family — spec-pinned.  4 new
  `webgpu` Playwright specs: segments polyline + ≤64 B re-route on
  drag, taxi axis-aligned legs + leg-vs-diagonal picking,
  round-segments corner-cutting vs the sharp corner (and the arc-apex
  midpoint), and the unbundled-bezier S through its inserted midpoint
  with a clear mirrored band.  All 66 Playwright specs green; 12a
  goldens byte-stable through the shader restructure.
- [x] **Arrows + edge labels on routes.**  The curved-arrow insight
  generalizes: a route's end tangent runs from the first/last interior
  route point to the boundary endpoint, so the arrow is the straight
  arrow math with that point substituted (taxi arrows ride the final
  axis-aligned leg).  Budget: the curved-arrow vertex stage needed the
  blob, so this end's arrow *colors* moved to the fragment stage — the
  VS no longer collapses no-arrow ends to degenerate quads (they
  rasterize a small fully-transparent quad instead; the frame uniform
  now binds V|F for edgeDim).  Edge labels of route edges anchor at
  `routeMidpointW` in the VS, and autorotate takes the midpoint
  tangent as its frame (v3's per-family disp rules) — both zero
  rebuild, both spec-pinned: taxi arrows purple on the final leg (and
  no ink on the chord diagonal), segments labels at the route midpoint
  with a ≤64 B re-anchor on drag.  68/68 Playwright specs; the 12a
  curved-arrows golden is byte-stable through the fragment-stage
  color move.
- [x] **Box selection: the curve-endpoint upgrade** (the revisit
  deferred from 12a).  `refsInBox` now tests a curved edge's *curve
  boundary endpoints* — exactly v3's on-boundary 'contain' rule, via
  the full-family CPU evaluator (curveEvalAt / curveRouteAt); straight
  edges keep the endpoint-center approximation (recorded deviation).
  2 new Node specs (segments and taxi containment, incl. the
  cut-the-launch-point miss cases).
- [x] **Goldens, live v3 parity and the benchmark check.**  Three new
  golden scenes — `unbundled-bezier` (S-splines across orientations, a
  dashed run, the unbundled loop), `segments-families` (sharp miter
  vs radius-18 round corners on the same zig-zag lists, a vertical
  round run, dashes riding legs) and `taxi-families` (auto/explicit
  directions, px and percent turns, round-taxi corners, arrows on the
  final legs, the forced-direction growth case) — byte-stable across
  repeat runs.  One combined **live v3-parity scene** covering all
  five families measured **0 differing pixels** at 8 px strokes (the
  same ink-guarded pixelmatch bound as 12a's parity-curves): the
  route geometry lands identically on both renderers; the known
  miter-vs-round join difference is absorbed by AA classification.
  Renderer benchmark re-run on the same box (RX 580, dpr 2, scale 1):
  the 12a curved scene's device times are unchanged (fit-all pan
  8.61 vs 8.6 ms, zoomed-in 3.81 vs 3.8, far-zoom 6.18 vs 6.4) — the
  route branch and blob binding cost the bezier path nothing
  measurable; wall clock stays vsync-bound at 16.7 ms while v3 canvas
  runs ~670 ms/frame on the same scene.  Final tallies: 1793 Node +
  60 module tests, 72/72 Playwright specs (6 new `webgpu`, 3 new
  goldens + 1 new parity in `webgpu-visual`), typecheck + lint clean.

## Landed (round 12c — endpoints + haystack + straight-triangle, 2026-07-30/31)

Pass 12c of the round-12 plan above, under the round-10 process rules.
Items landed CPU-first; each entry below was written in the commit that
landed it.  **Round 12c is complete**: props, derivation, accessors,
exact bb, render, cull, pick, arrows, labels, box selection, goldens,
live v3 parity and benchmarks all landed — the round-12 curved-edges
plan (12a/12b/12c) is done.

- [x] **Contract + CPU geometry: endpoint blocks, haystack, triangle**
  (2026-07-30).  Three additions to the curve contract:
  `CURVE_HAYSTACK` and `CURVE_TRIANGLE` are *straight-stream* kinds
  (FLAG_CURVED stays clear — haystack rides the straight pipeline and
  its far-zoom decimation, resolving 12a's "curved stream is never
  decimated" revisit by construction), and `CURVE_HAS_ENDPT` flags a
  blob-backed kind (MULTI/SEGMENTS/TAXI) whose record is prefixed by a
  fixed 10-float **endpoint block** —
  [mode, a, b, pctBits, dist] × 2 — resolving `source/target-endpoint`
  and `source/target-distance-from-node`.  Modes are v3's edgeEndpoint
  forms (outside-to-node default, inside-to-node, outside-to-line,
  point with per-component %/px units, angle with the 12-o'clock start
  folded in at parse time); distances shorten via v3's
  `shortenIntersection` clamp rule.  Structural calls, recorded in the
  geometry module doc: a *straight* edge with manual endpoints derives
  as `CURVE_MULTI n = 0` (the route degenerates to the chord between
  the resolved endpoints — `routeVertex`/`routeMidpoint` already
  handle it), and a *bundled bezier* with manual endpoints promotes to
  `CURVE_MULTI n = 1` (its control formula is identical — pinned by a
  spec against the 12a analytic path).  `edge-distances: 'endpoints'`
  re-bases the frame on the raw manual anchors with v3's
  recalcVectorNormInverse normal.  Haystack endpoints are
  `center + (cos/sin(angle) · outerHalf · radius)` with **hash-stable
  angles from the edge's id hash** (deterministic across sessions and
  machines — v3 uses Math.random(), so haystack scenes are only
  statistically v3-comparable; v4 also scales by outer halves where v3
  uses inner size — identical at border 0, recorded).  17 Node specs
  (`test/gpu-curve-endpoints.mjs`) pin the block resolution, the
  n = 0 chord, the bezier-promotion equivalence, the endpoints-frame
  rebase, taxi distances, and the haystack point/angle math.
- [x] **Style props + derivation** (2026-07-30).  `curve-style` gains
  `haystack` | `straight-triangle`; new edge props `haystack-radius`
  (validated [0, 1], v3 default 0), `source/target-endpoint`
  (keyword | 'x y' point with per-component %/px units | angle as
  deg/rad string or plain radians; the `-or-label` keywords throw —
  no label bb in v4), and `source/target-distance-from-node`
  (non-negative).  `edge-distances: 'endpoints'` parses; derivation
  enforces v3's both-ends-manual rule and falls back to intersection
  with v3's warning otherwise.  Scalars (`haystack-radius`, the two
  distances) are mapper-capable; the endpoint props are
  constants-only (the point form is a list — the 12b scope rule).
  Derivation (CurveIndex): haystack derives per edge into the
  straight-stream params (id-hash angles via the store's blob-native
  id hashes, so two loads of the same graph derive identical
  haystacks); triangle likewise; any edge with a non-default endpoint
  spec derives its blob record with the 10-float block prefix and the
  kind flag — straight → MULTI n = 0, bundled bezier → promoted
  MULTI n = 1 (derivePair consults the spec; the odd-middle/lone
  rules produce endpoint chords), taxi → modes forced default (v3's
  keyword override) with distances kept, dropping the flag when
  nothing remains.  Cull soundness: px point offsets fold into the
  record's header deviation; pct offsets are measured in node-half
  units — ≤ 1 is covered by the slack's node-half term, > 1 marks the
  edge FLAG_CURVED_BOX and feeds a new monotone `endptPctMax` term in
  `curveSlack()`; `haystackSlack()` (radiusMax × node half) is the
  bound the *straight*-stream cull tests will grow by in the renderer
  item.  Haystack styling also suppresses arrows at the style layer
  (v3 draws none; stored-truth arrow getters read 'none' — recorded),
  and `refsInBox` tests haystack offset points (v3's haystackPts).
  Readback: `curve-style`/`haystack-radius` off the styled record;
  endpoints as canonical strings (keywords, 'x y' with % suffixes,
  '<rad>rad' angles); distances as numbers.  21 Node specs
  (`test/gpu-curve-12c-derivation.mjs`); two 12b-era specs updated to
  the new surface (haystack/edge-distances no longer throw).  1831
  Node tests, typecheck + lint green.
- [x] **Accessors + exact bb** (2026-07-30).  Haystack edges answer
  `sourceEndpoint()`/`targetEndpoint()` with their offset points
  (v3's haystackPts), `midpoint()` with the offset-point average
  (v3's rs.mid), and `boundingBox()` with the exact offset-point
  span; endpoint-flagged route kinds flow through `curveRouteAt`
  automatically, so manual-endpoint edges answer every accessor —
  resolved endpoints, chord midpoints, the promoted bundled bezier's
  control point, distance shortens on taxi — off the shared route
  evaluator, and the exact lazy bb covers manual endpoints outside
  the chord with the usual epoch-memoized invalidation.
  `controlPoints()` returns undefined for the straight-with-endpoints
  chord (MULTI n = 0 — no controls, matching v3's straight surface).
  11 Node specs (`test/gpu-curve-12c-accessors.mjs`); 1842 Node
  tests, typecheck + lint green.
- [x] **Renderer: straight-stream kinds, endpoint WGSL twins, cull
  slack** (2026-07-31).  The straight edge shader restructured: paint
  columns (line color / opacity / line-style) moved to the *fragment*
  stage via flat instance fetch (the curved pipeline's split), freeing
  vertex slots for `edge.curveParams` + `node.outerHalf` +
  `node.shape` — 6 VS storage buffers + the visible list.  The VS
  branches on the straight-stream kinds: haystack offsets both
  endpoints by (cos/sin(angle) · outerHalf · radius) from live
  positions (drags follow on-GPU), and straight-triangle computes
  boundary endpoints and tapers the half-width to zero at the apex
  (the FS's varying half-width keeps the AA exact; dashes skip
  triangle fills, v3's fill path; the pick FS inherits the taper, so
  picking matches the drawn triangle).  ROUTE_WGSL gained the
  endpoint-block twins (`rawEndptAnchorW`/`resolveEndptW`, the
  kind-flag strip, the n = 0 chord aims, and the
  `edge-distances: endpoints` frame rebase) — the label VS's route
  branch and the curved pick tile inherit them; route arrows now
  anchor at the route's *resolved* endpoint (q[0]/q[n+1] — for
  default modes exactly the old boundary point, for manual endpoints
  v3's arrowStart/End), aiming along the end tangent (the far
  endpoint for the n = 0 chord).  The edge-label VS anchors haystack
  owners at the offset midpoint with autorotate along the offset
  line.  The Frame uniform grew 48 → 64 bytes with `haystackSlack`
  (radiusMax × node half, monotone): the straight-edge cull and the
  edge-glyph cull grow their corridor/anchor tests by it, so haystack
  never culls wrong while staying decimated like any straight edge.
  4 new `webgpu` Playwright specs (haystack offset line + pick,
  triangle taper + taper-matched picking, manual endpoints off the
  chord + ≤ 64 B drag re-anchor, arrows at a shortened endpoint with
  the gap behind them) — 54/54 `webgpu`, 22/22 `webgpu-visual`
  (goldens byte-stable through the shader restructure, parity scenes
  0 px), 1842 Node tests, typecheck + lint green.
- [x] **Goldens, live v3 parity and the benchmark check**
  (2026-07-31).  Three new golden scenes — `haystack` (8 edges at
  radius 0.9; the id-hash angles make the scene deterministic across
  machines, which is what lets a haystack golden exist at all),
  `straight-triangle` (three orientations + an arrowed apex) and
  `manual-endpoints` (a px point source end, an angle target end, a
  source distance and an unbundled bezier under
  `edge-distances: endpoints`) — stable across repeat runs.  Three
  new **live v3-parity scenes**, all measuring **0 differing
  pixels** at 8 px strokes: `parity-endpoints` (the same endpoint
  config across orientations — v3's shorten matches v4's dist rule
  exactly at arrow gap 0), `parity-triangle`, and
  `parity-haystack0` — haystack at radius 0 pins the haystack
  *pipeline* against v3 exactly (both sides collapse to
  center-to-center lines); radius > 0 has no exact v3 parity by
  construction (v3 seeds with Math.random()), which the
  deterministic golden covers instead — the recorded deviation.
  Renderer benchmark re-run (same box, RX 580, dpr 2, scale 1):
  device p50s unchanged from the 12b record — straight gen-25k
  fit-all/zoomed/far 3.34/4.40/1.26 ms (was 3.3/4.4/1.2), curved
  8.61/3.81/6.30 ms (was 8.6/3.8/6.4) — the paint-to-FS restructure
  cost nothing measurable, and far-zoom haystack rides the straight
  stream's decimation by construction (the 12a revisit closed).
  Final tallies: 1842 Node + 60 module tests, 54/54 `webgpu` +
  28/28 `webgpu-visual` Playwright specs (3 new goldens, 3 new
  parity scenes), typecheck + lint clean.  **Round 12c is complete**
  — and with it the whole round-12 curved-edges plan.

## Landed (edge-label autorotate, 2026-07-29)

The last item on the autonomous shelf, cleared while planning round 12:
`text-rotation: autorotate` for edge labels, one isolated commit.

- **API**: `text-rotation` is an edge style prop — keywords `none`
  (default, horizontal) | `autorotate`, constants or mappers (enum
  kind, so `case` conditionals work, matching the other label
  channels).  Numeric rotations throw (per-element numeric
  `text-rotation` stays in the label-parity needs-a-call batch), and
  the prop throws on the nodes group (node labels don't rotate in v4).
  Readback follows the stored-truth rule: the sidecar entry when
  labelled, else the sheet.
- **The flip-rule call** (the one that was open): **v3's verbatim** —
  the label angle is the edge's *undirected* slope, v3's
  `atan(dy/dx)` (`labels.mts:95`), so the baseline stays within
  (−90°, 90°] and text never reads upside-down; vertical edges read
  top-to-bottom at +90° either direction.  The WGSL implements the
  same rule with no trig: it sign-normalizes the endpoint delta
  (negated when it points left, or straight up at dx = 0) and uses
  the unit vector as the rotation frame (`autorotateFrame`).
- **Mechanism**: rotation happens in the vertex shader from the live
  endpoint positions, so autorotate inherits the edge-label
  zero-rebuild property — drags, layouts and position tweens re-angle
  the label on-GPU (spec-pinned: making a vertical edge horizontal
  re-uploads ≤ 64 B, one position row).  The model bakes only a flag:
  bit 31 of the glyph instance's owner word (element slots stay far
  below 2³¹; the dead sentinel is the full-ones word, so no
  collision).  The background quad carries the flag too — a text box
  rotates with its text — and the edge-glyph cull kernel tests the
  exact rotated-rect AABB in the same rotation frame as the VS, so
  cull and draw can't disagree.  Node glyph paths are untouched, and
  the non-rotated edge path keeps its original arithmetic —
  pre-existing goldens pass unchanged.
- **Verification**: typecheck + lint clean; 1650 Node tests (5 new in
  `test/gpu-edge-labels.mjs`: entry + readback, defaults +
  sheet-resolution, throws for numbers/unknown keywords/nodes-group,
  case mappers, node-entries-never-rotate); 40/40 `webgpu` Playwright
  specs (new: a vertical-edge spec pinning the dark-pixel bounding box
  flipping from wide to tall under autorotate, plus the ≤ 64 B
  re-angle on an endpoint move); 13/13 `webgpu-visual` (new
  `edge-label-autorotate` golden: a downhill run, a direction-flipped
  uphill run with its background box rotated along, and a vertical
  top-to-bottom run — all pre-existing goldens unchanged).

## Landed (round 13 — style-prop parity, complete 2026-07-31)

Executed the round-13 plan below under the round-10 process rules.
Each item landed as isolated commits with docs in-commit; the records
below were written per item, in the same commits as the work.

- [x] **A1 Ghost props** (2026-07-31).  `ghost` ('yes' | 'no'),
  `ghost-offset-x/y`, `ghost-opacity` (validated [0, 1]; v3 defaults —
  a ghost is invisible until given opacity) — node-only, all four
  mapper-capable ('case' works for `ghost` as an enum).  The decided
  simplified form, verbatim: a new `node.ghost` column
  ([offX, offY, opacity, enabled], f32×4) drives a **ghost pass** —
  the node shader gained `vsGhost`/`fsGhost` entry points drawing the
  body (shape, border, background — no accent ring, no hover/grab
  brighten, no labels) at the offset with alpha × ghost-opacity, off
  its own cull stream (a new 'ghost' cull kind: node SHOWN + enabled +
  visible opacity + the *offset* quad on screen), drawn after
  edges/arrows and depth-tested 'less' at NODE_Z so ghost fragments
  under opaque node interiors are killed — exactly v3's
  node-over-ghost layering, for free off the early-z prepass.
  Zero-cost when unused: the store tracks a live ghost-enabled count
  and the renderer skips the ghost cull + draw entirely at 0.  Ghost
  offsets are geometry: both bb scans (store fit + collection) grow by
  the offset body when enabled.  Deviations, recorded: ghosts are not
  pickable (v3 same — decoration only), and box selection ignores
  ghost extents (v4's `refsInBox` tests the body box only).  8 Node
  specs (`test/gpu-ghost.mjs`), a `webgpu` spec (ghost at the offset,
  not pickable, follows drags on-GPU, old spot clears), a `ghost`
  golden (three shapes with borders at one offset), and a
  `parity-ghost` live v3 scene — 0.945% mismatch (AA-classification
  seams only; for label-free nodes v3's whole-node ghost redraw *is*
  the body duplicate, so the scenes are directly comparable).  1850
  Node tests, 55 `webgpu` + 30 `webgpu-visual` specs, typecheck + lint
  green.

- [x] **A2 (nodes): overlay/underlay layers** (2026-07-31).  The 10
  `overlay-*`/`underlay-*` element props for **nodes** (edge layers
  are the next A2 slice): color/opacity/padding mapper-capable,
  shape (`round-rectangle` | `ellipse`) and corner-radius (number |
  `'auto'` — v3's min(w/4, h/4, 8), resolved in the shader from live
  extents) as constants; v3 defaults (opacity 0, padding 10).  Two
  packed `Uint32Array×4` columns ([rgba folded, padding×256, shape,
  radius×256|auto]) drive one `NODE_LAYER_SHADER` instantiated per
  layer, drawn off a shared 'nodeLayer' cull kind (two CulledGroups,
  each binding its layer's column): the underlay after ghosts and
  under the bodies (depth-tested — early-z hides it under opaque
  interiors, v3's layering for free), the overlay after the bodies.
  Layer opacity folds into the stored alpha (readback follows the
  arrow-color precedent); element opacity does not multiply (v3).
  Padding is geometry: both bb scans grow by the enabled layer's
  pad.  Zero-cost when unused (per-layer live counts gate cull +
  draw).  Deviations, recorded: v4 overlays draw *under* the label
  layer (v3 draws overlay over its node's label); overlays are not
  pickable and box selection ignores their pads.  8 Node specs
  (`test/gpu-node-layers.mjs`), a `webgpu` spec (overlay wash +
  underlay ring), a `node-layers` golden, and a
  `parity-node-layers` live v3 scene at **0 px differing**.  1858
  Node tests, 56 `webgpu` + 32 `webgpu-visual` specs, typecheck +
  lint green.

- [x] **A2 (edges): overlay/underlay strokes** (2026-07-31).  The
  layer paint props (`overlay-color`/`-opacity`/`-padding` +
  underlay) now apply to **edges** too: the edge geometry re-stroked
  at width + 2 × padding (pre-derived at style-write into packed
  `Uint32Array×2` columns — [rgba folded, strokeWidth×256] — so the
  layer shaders need no width binding), the underlay under the
  edges, the overlay over edges + arrows, both under the nodes
  (v3's layering).  New `vsEdgeLayer`/`vsCurvedLayer` entry points
  ride the *existing* edge/curved visible lists with a VS collapse
  for disabled instances (no new cull kind; per-layer live counts
  gate the draws — zero cost when unused); the curved layer draw
  has its **own bind group layout** that omits the widths column —
  pipeline *layouts* count against the per-stage 8-storage-buffer
  limit even for bindings a shader never references, which the
  Playwright console-error guard caught as an invalid-pipeline
  cascade on the first cut.  Haystack offsets and the
  straight-triangle taper apply to layer strokes too; layer strokes
  are solid (no dashes) with butt caps where v3 rounds stroke ends —
  a recorded deviation confined to the ends.  `overlay-shape`/
  `-corner-radius` stay node-only (v3 ignores them on edges; v4
  rejects them).  Edge-layer readback: color folded, padding =
  (stroke − width) / 2.  Node-layer suite extended (edge cases);
  an `edge-layers` golden (straight + taxi + loop under both
  layers) and a `parity-edge-layers` live v3 scene at 2.047%
  mismatch (the caps + AA).  1858 Node tests, 90 Playwright specs,
  typecheck + lint green.

- [x] **A2 (core): selection-box + active-bg theming** (2026-07-31).
  The sheet gains an optional **`core` group** — the v4 home for v3's
  core-selector props, constants only (there is no element to map
  over): `selection-box-color`/`-opacity`/`-border-color`/
  `-border-width` theme the DOM selection box (previously hardcoded ≈
  v3 colors; now v3's exact defaults — #ddd at 0.65 with a 1px #aaa
  border — applied per show, so a sheet swap restyles the next box),
  and `active-bg-color`/`-opacity`/`-size` drive the **background-grab
  indicator**: v3's active-bg circle, shown at the press point while
  the background is grabbed (v4 implements it as a DOM circle above
  the canvas, like the selection box — a recorded implementation
  note: v3 draws it into the canvas, so it never appears in v4
  exports), radius = active-bg-size screen px (v3's size/zoom-in-model
  ⇒ screen-fixed rule).  A2 is now **complete** (nodes + edges +
  core).  4 Node specs (`test/gpu-core-style.mjs` — defaults,
  camel/kebab parsing, sheet-reset, throws) and a `webgpu` spec
  (themed box colors mid-drag; the circle appears on a background
  press at 2×size px and hides on release).  1862 Node tests, 91
  Playwright specs, typecheck + lint green.

- [x] **B1 Opacity split** (2026-07-31).  `background-opacity`,
  `border-opacity` (nodes), `line-opacity` (edges) and `text-opacity`
  (both groups) land as **write-time folds** into the stored channel
  alphas — no new columns, no shader changes: fill alpha ×= bg
  opacity, border ×= border opacity, line ×= line opacity, and the
  label sidecar folds text-opacity into the text/outline/background
  alphas alike (v3's parentOpacity).  Element `opacity` stays its own
  column multiplied in the FS, so v3's effective = channel × element
  holds; the arrow fold gains the line-opacity factor (v3's
  `effectiveArrowOpacity = opacity × lineOpacity`), threaded through
  `foldedArrow`, the kernel's constOpacity, and the edge-opacity
  tween's arrow targets.  All four are mapper-capable
  (CPU-evaluated).  GPU-eval interplay, the recorded scope note: a
  non-1 (or mapped) channel opacity **demotes that color channel's
  kernel eval to the CPU path** — the kernel would overwrite the
  folded bytes — via a `paintInputs` exclusion (a mapped line-opacity
  also demotes the arrow colors).  Early-z stays sound for free: the
  prepass already discards nodes whose stored fill alpha < 1.
  Readback is folded (stored alpha / 255 — the outline/arrow
  precedent), and a line-transparent edge reads its arrows as 'none'.
  7 Node specs (`test/gpu-opacity-split.mjs` — folds, mappers, the
  kernel demotion, ranges) and a `parity-opacity-split` live v3
  scene at 0.934% mismatch (translucent AA seams).  1869 Node tests,
  92 Playwright specs, typecheck + lint green.

- [x] **B2 border-position + corner-radius** (2026-07-31).  One new
  `node.borderGeom` column ([cornerRadius | −1 = auto,
  borderPosition]).  `border-position` (center | inside | outside —
  and **v4's default flips to v3's `center`**: the border band now
  straddles the boundary, [−bw/2, +bw/2]; v4 had silently drawn all
  borders inside, an unrecorded deviation this closes — parity-basic
  fell 0.766% → 0.072% and parity-transform 0.486% → 0.238% on the
  spot).  `corner-radius` (number | 'auto') feeds the
  round-rectangle SDF everywhere the radius appears — node FS, ghost
  FS, the depth prepass' interior test, and the CPU pick replica —
  with **'auto' now v3's min(w/4, h/4, 8)** (v4 had used
  min(w, h)/8; also closed).  The node/ghost quads, node cull and
  ghost cull grow by the border's outward extent (the ghost cull
  uses the full border width — the compute stage had no slot left
  for the position column; conservative only).  Both props are
  mapper-capable (enum/number, CPU — geometry tier: the pick reads
  them).  bb keeps the outerHalf center convention for all positions
  (v3's outerWidth does the same — recorded).  Caught by the guard
  en route: the first ghost-cull cut hit 9 compute storage buffers.
  4 goldens regenerated as the intended visual change
  (nodes-edges-arrows, polygon-shapes, selection-accent, ghost); a
  new `parity-border-geom` scene (three positions × explicit radii)
  measures **0 px differing**.  4 Node specs
  (`test/gpu-border-geom.mjs`) + the CPU-pick suite pinned to the
  new auto rule.  1873 Node tests, 93 Playwright specs, typecheck +
  lint green.

- [x] **B3 line-cap + dash patterns** (2026-07-31).
  `line-dash-pattern` (constants-only list, normalized to two on/off
  pairs — odd patterns double per canvas semantics, longer ones
  truncate, a recorded cap), `line-dash-offset` and `line-cap`
  (butt | round | square; cap + offset mapper-capable) land in two
  columns (`edge.dashPattern` f32×4, `edge.dashMeta` [offset, cap])
  bound fragment-side on both edge pipelines.  The dash mask became
  a proper 2D coverage: `dashInsideSd` (signed model-px distance
  inside the nearest on-segment, wrap-exact) + `dashCoverage` —
  butt is the plain product (pixel-identical to the old mask, so
  the pre-B3 goldens held), round is a capsule about the segment,
  square extends each dash by the half width.  Dashed edges use the
  per-edge pattern (v3); dotted stays [1, 1]; triangle fills ignore
  line-style (v3).  **A dash-phase deviation found and fixed**: v3
  launches the pattern at the *source boundary* while v4's straight
  edges measured u from the node center — the straight VS now
  subtracts the source boundary offset (haystack lines keep their
  offset-point origin, matching v3's haystackPts), taking the new
  `parity-dash-props` scene (pattern + offset + all three caps)
  from 2.501% to **0 px differing**.  Caught en route by the Node
  WGSL-identifier guard's runtime sibling: `meta` is a WGSL reserved
  word.  Line-end caps are dash-segment-only (quads don't extend
  past the endpoints; v3's default butt behaves identically) — a
  recorded deviation.  6 Node specs (`test/gpu-dash-props.mjs`);
  the line-styles golden regenerated for the intended phase shift.
  1879 Node tests, 94 Playwright specs, typecheck + lint green.

- [x] **B4 edge casing** (2026-07-31).  `line-outline-width`/
  `line-outline-color` ride the A2 layer machinery verbatim: an
  `edge.casing` column in the layer record layout ([rgba folded by
  v3's effectiveLineOpacity = opacity × line-opacity,
  strokeWidth×256 = width + outline width — v3's lineWidth]), drawn
  by the existing `vsEdgeLayer`/`vsCurvedLayer` entry points between
  the edge underlay and the edge line, on every family (haystack
  offsets and the triangle taper included).  Both props
  mapper-capable; zero-cost when unused (casingCount gating).  A
  kernel-owned element opacity would leave stale casing bytes, so an
  enabled (or mapped) casing demotes the `opacity` mapper to the CPU
  path — the B1 exclusion list extended.  `parity-casing` (straight
  + bezier pair + taxi under an 8 px casing) measures **0.061%** —
  the recorded butt-vs-round stroke-end deviation only.  5 Node
  specs (`test/gpu-edge-casing.mjs`).  1884 Node tests, 95
  Playwright specs, typecheck + lint green.

- [x] **B5 node outlines** (2026-07-31).  `outline-color`/
  `-opacity`/`-width`/`-offset` (solid only — `outline-style` stays
  out with `border-style`, the perimeter-parameterization limit).
  The `node.borderGeom` column widened to `Uint32Array×4`
  ([radius×256 | auto, position, outlineRgba (opacity folded),
  width×256 | offset×256 ≪ 16]) — the node FS sat at exactly 8
  storage buffers, so the outline packs into the existing binding.
  The ring renders as a second disjoint SDF band at
  `borderOutward + offset/2` (v3 strokes a path scaled by
  (size + bEff + width + offset)/size, which reduces to exactly
  this band for circles/squares — pinned by `parity-outline` at
  **0 px** including an offset-10 case and a bordered case;
  anisotropic shapes deviate from v3's scaled-path stroke by
  construction, recorded).  Ghost bodies draw their outline too
  (v3).  Node quads/cull grow exactly; the ghost cull grows by the
  new monotone `outlineSlack()` via the Frame's last pad (no
  binding left there); both bb scans grow by offset/2 + width.  All
  four props mapper-capable; readback folded/packed.  5 Node specs
  (`test/gpu-node-outline.mjs`); the B2/CPU-pick suites re-pinned
  to the packed format.  1889 Node tests, 96 Playwright specs,
  typecheck + lint green.

- [x] **B6 label box parity** (2026-07-31).  `text-transform`
  (none | uppercase | lowercase — applied at glyph-run build, as v3
  transforms before measuring), `text-border-width`/`-color`/
  `-opacity` (a band drawn inward from the padded background box —
  the bg quad's unused outline instance fields carry the border, so
  the glyph layout is unchanged) and `text-background-shape`
  (rectangle | round-rectangle, v3's auto radius — the shape flag
  rides the solid quad's free uv1.x).  The label FS's solid branch
  became a proper quad SDF (corner-space + quad-size varyings), so
  round boxes and borders AA exactly; all five props are
  mapper-capable and stored-truth readback follows the folded rule.
  `text-border-style` stays out with the other dash-a-boundary
  styles.  **No live v3 parity by design**: label raster *and*
  placement differ from v3 (the round-9.6/9.7 decisions), so the
  visual pin is the label-tier `label-boxes` golden (uppercase
  transform, bordered box, round bordered box in the fixed web
  font) — v3 comparison for label props is structurally excluded,
  as recorded since round 9.6.  6 Node specs
  (`test/gpu-label-box.mjs`).  1895 Node tests, 97 Playwright
  specs, typecheck + lint green.

- [x] **B7 arrow scalars** (2026-07-31).  `arrow-scale` (edge-wide,
  positive; quantized ×16 into the shapes word's top byte — quantized
  readback, recorded), `source/target-arrow-fill`
  (filled | hollow — flags at bits 16/17) and
  `source/target-arrow-width` (px | 'match-line' | %, resolved
  against the edge width at style-write into a new
  `edge.arrowWidths` column).  Both arrow shaders restructured:
  exact sizing moved to the **fragment stage** — the quad covers the
  frame's monotone `arrowScaleMax` (a Frame pad slot) and the FS
  renders the exact per-edge scale within it, which is what lets the
  curved arrow VS (whose 8 storage-buffer slots were all taken) stay
  untouched; hollow fills render as an `|sd|` ring at the per-end
  stroke width.  Scale/fill are mapper-capable; widths are constants
  (keyword/% forms).  **No pixel parity vs v3 by design**: v4 keeps
  its own linear arrow sizing (round-10 B4's recorded decision; v3
  uses max((13.37 w)^0.9, 29) with a 29-unit floor), so arrow sizes
  never coincide — the visual pins are the `arrow-scalars` golden
  (scale 2, hollow ends, thick hollow strokes) and a `webgpu`
  hollow-ring pixel spec.  6 Node specs
  (`test/gpu-arrow-scalars.mjs`).  1901 Node tests, 99 Playwright
  specs, typecheck + lint green.

- [x] **C1 mid-arrows** (2026-07-31).  `mid-source/mid-target-arrow-
  shape`/`-color` land exactly as re-triaged: two folded color columns
  plus the mid shape ids packed into the arrowShapes word's free bits
  (18..20 / 21..23 — every ARROW_* id fits in 3 bits), drawn by new
  `vsMidArrow` entry points on both arrow pipelines whose `End`
  uniform generalized to an endId (target / source / mid-target /
  mid-source, four cached bind groups each).  Straight edges anchor
  the tip at the chord midpoint (the haystack *offset* midpoint for
  kind 6 — the straight arrow layout gained the curveParams binding,
  landing at its 8-buffer budget exactly); curved edges reuse the
  label VS's midpoint machinery — the curve midpoint/loop c1→c2
  tangent analytically, `routeMidpointW` for the route families — so
  mid arrows follow drags/layouts/tweens on-GPU like everything else;
  mid-source points backward (v3's midsrcArrowAngle).  Mid arrows are
  always filled at standard width (the mid fill/width props are
  unsupported — recorded), shapes/colors are mapper-capable, stored
  truth reads transparent mids as 'none', and per-edge draws gate on
  a live midArrowCount.  **Fixed en route: a latent round-10 gate bug**
  — the arrow-draw enable checked `shape === 'triangle'`, so constant
  vee/chevron/circle/... sheets never drew arrows at all; now any
  non-'none' shape draws.  (Follow-up, same day: the B7
  `arrow-scalars` golden predated this fix — its scene's constant
  `source-arrow-shape: circle` arrows never drew when the golden was
  generated — so it went stale the moment the gate was fixed;
  regenerated in its own commit once the C3 full-suite run caught
  the 0.931% drift.)  Sizing shares B7's v4-linear formula (no
  pixel parity vs v3 by the recorded B4 decision) — the pins are the
  `mid-arrows` golden (straight + bezier pair + taxi + haystack) and
  a `webgpu` spec asserting purple mid-arrow ink at the CPU-computed
  `renderedMidpoint()` of both a straight and a curved edge.  3 Node
  specs (`test/gpu-mid-arrows.mjs`).  1904 Node tests, 100 Playwright
  specs, typecheck + lint green.

- [x] **C2 gradients** (2026-07-31).  `background-fill`
  (solid | linear-gradient | radial-gradient) with
  `background-gradient-stop-colors`/`-stop-positions`/`-direction`
  (v3's eight `to-*` keywords), and `line-fill` with
  `line-gradient-stop-colors`/`-stop-positions`.  Storage: one packed
  `Uint32Array×8` record per element ([meta kind|dir|count, 5 stop
  colors, packed positions]) — **stops cap at 5** and stop lists are
  constants-only (recorded); fills/directions are mapper-capable
  enums.  Stops interpolate in **sRGB** (the plan's lean: v3's canvas
  gradients; OKLab stays the mapper default), positions spread evenly
  when unset and clamp monotone (canvas semantics), and the channel
  opacity folds into each stop.  Binding budget: the node FS was full,
  so the **shape id folded into borderGeom** (bits 16..19, written
  with the style's other geometry) freeing the shapes binding for the
  gradient record; edge gradients bind fragment-side on both edge
  pipelines, with the drawn span (boundary-to-boundary for straight,
  the polyline arc length for curved) as a new flat varying so linear
  fills run v3's extent and radial fills mirror about the midpoint.
  The depth prepass conservatively discards gradient fills
  (translucent-anywhere); plain-LOD discs keep the flat base color
  (recorded).  `parity-gradients` (three-stop linear on rectangles +
  a gradient line vs v3) measures **0 px differing** — the sRGB lerp
  matches canvas exactly; the `gradients` golden covers directions,
  radial, ellipse and curved-line fills.  6 Node specs
  (`test/gpu-gradients.mjs`).  1910 Node tests, 102 Playwright specs,
  typecheck + lint green.

## Round 13 plan — style-prop parity (planned 2026-07-30; completed 2026-07-31 — see the round-13 Landed section above)

A prop-level sweep of the v3 style registry
(`src/style/properties.mts`: 280 registered props + 11 aliases)
against the v4 engine, asking one question per prop: is it
implementable **entirely under existing design decisions** — a new
channel column plus parse/mapper/stored-truth-readback plumbing plus
fragment-stage shader work, the pattern rounds 10 B2/B3/B4 (line
styles, label visuals, arrow shapes) established — with no new
subsystem and no open API-semantics call?  Roughly 55 props qualify;
they are this round.  The paint props are cheap for a structural
reason: colors/opacities fetch in the fragment stage (the
flat-instance-fetch precedent), so they never touch the
8-storage-buffer vertex budgets that constrain geometry work.  This
round refills the autonomous shelf; the design queue (compounds →
background images → event vocabulary/extension contract → force
layout) is not consumed by it.

- [x] **C3 custom polygons** (2026-07-31).  `shape: 'polygon'` +
  `shape-polygon-points` land on the round-11 blob pattern: a second
  `CurveBlob` pool holds each node's flat unit pairs, slot-stable
  compaction rewrites the packed offset|count<<24 ref that rides the
  `borderGeom` radius word (meaningless for polygons), and the
  column mirror ships the pool as one more growable buffer
  (`delta.polyBlob`).  The node FS gained `customPolySD` — iq's
  exact sdPolygon over the blob range scaled to device space, so AA,
  borders and the depth prepass's interior test stay crisp under
  anisotropy like the generated shapes — and CPU pick runs
  point-in-polygon over the same record: dual consumers of one ref,
  agreeing by construction.  Binding budget: the poly blob is the
  node stage's 9th storage buffer, so the node pipelines split into
  two layouts — main/prepass drop the ghost column (their entry
  points never read it), the ghost pipeline drops `node.flags` (no
  accent/hover on ghosts) — each landing at exactly 8 FS storage
  buffers; the ghost FS also gained the C2 gradient branch it was
  missing.  Points are constants-only, validated (even count, >= 3
  pairs, [-1, 1] range — v3's evenMultiple/min/max rules), capped
  at 32 points (recorded), default to v3's unit square, read back
  as the space-joined list, and free their pool record on
  non-polygon restyle and node removal.  WGSL lesson repeated:
  `ref` is a reserved word (caught by the console-error guard).
  Verification: 9 Node specs (`test/gpu-shape-polygon.mjs`: parse /
  readback / validation / blob refs / free-on-restyle / pick
  inside-ness incl. a pool-rewrite case), a `webgpu` spec (draw +
  pick agree on the point list at pixel level), the `shape-polygon`
  golden (concave arrow outline over bordered / anisotropic / small
  nodes), and **`parity-polygon` vs v3 at 0.005%** (6 px of AA on a
  shared concave-arrow scene — pure geometry, near pixel-exact).
  1919 Node tests, 106 Playwright specs, typecheck + lint green.

- [x] **D1 `font-style` + `font-weight`** (2026-07-31).  Both land
  as global constants riding the `font-family` rule: the store's
  face triple (`labelFont`/`labelFontStyle`/`labelFontWeight`) feeds
  the atlas's CSS font shorthand
  (`style weight ${SDF_FONT_SIZE}px family`), and any change marks
  every labelled slot dirty so the atlas reset and the glyph-run
  rebuild land in one pass — no new columns, no shader changes.
  Values: v3's sets (`normal | italic | oblique`; the weight
  keywords plus the numeric hundreds 100..900, read back as
  strings); edges-group use and mappers throw via the generalized
  `GLOBAL_FONT_PROPS` guard (same messages as `font-family`).  The
  playwright page gained the real Open Sans 700-italic `@font-face`
  so the D1 golden pins an actual face, not browser synthesis.  No
  v3 pixel parity for labels by recorded design (raster + placement
  differ) — the pins are the `labels-bold-italic` golden (label
  tolerance) and a `webgpu` spec asserting bold ink > normal ink in
  the label band plus a nonzero italic-vs-upright pixel diff.  7
  Node specs (`test/gpu-font-props.mjs`).  1926 Node tests, 108
  Playwright specs, typecheck + lint green.

- [x] **D2 `min-zoomed-font-size`** (2026-07-31).  Per-element, as
  planned: the prop rides the label sidecar (mapper-capable, both
  groups, v3's default 0 = no floor) and bakes into each glyph as a
  precomputed `zoomDprMin = minZoomed / fontSize` — the Glyph struct
  grew 12→14 words (56-byte stride, one f32 + explicit pad) — so
  both glyph cull kinds test `frame.zoomDpr < zoomDprMin` before the
  global `labelFadePx`/`labelMinPx` predicates: v3's
  `eleTextBiggerThanMin` (`fontSize × zoom × pxRatio < minSize` ⇒
  hide), evaluated on-GPU per glyph with zero per-frame CPU work,
  and the background quad hides with its text.  Fixed en route:
  `setLabel`'s no-op equality check learns the new field (a restyle
  changing only the floor previously kept the stale sidecar).  No
  label pixel parity vs v3 by recorded design — the pin is a
  `webgpu` LOD spec (floored + unfloored labels: both draw at zoom
  1, only the floored one vanishes at zoom 0.7, and it returns at
  zoom 1 — a pure cull, no rebuild) plus 4 Node specs
  (`test/gpu-min-zoomed-font-size.mjs`).  1930 Node tests, 109
  Playwright specs, typecheck + lint green.

- [x] **D3 `text-valign`/`text-halign`** (2026-07-31).  v3's 3×3
  node-label anchor grid, mapper-capable and node-only (the edges
  group throws, like v3 forcing edge labels to center/center).  The
  sidecar entry carries the node-extent base (`anchorX` =
  (halign−1)·w/2; `anchorY` per valign with the round-10 4 px
  label margin on the top/bottom rows) plus block-fraction shifts
  (halign −0.5/0/+0.5 of the laid width; valign −1/−0.5/0 of the
  laid height) that the glyph builder resolves once the run's real
  dimensions are known — placement only, no shader or cull changes,
  and the background box anchors with its text.  **Recorded
  deviation: v4's default `text-valign` stays `'bottom'`** (the
  round-10 below-node placement every existing golden pins); v3
  defaults to `'top'`.  The v3 `padding`-based gap is approximated
  by the fixed 4 px label margin (v4 has no `padding` prop).  No
  label pixel parity vs v3 by recorded design — pins are the
  `label-align` golden (all nine (halign, valign) pairs with
  background boxes) and a `webgpu` spec asserting ink moves
  above-left for top-left and below-right after a bottom-right
  restyle, with the opposite bands empty.  6 Node specs
  (`test/gpu-text-align.mjs`).  1936 Node tests, 111 Playwright
  specs, typecheck + lint green.

- [x] **D4 `source-label`/`target-label` families** (2026-07-31).
  All ten props land: `source/target-label` (constants or the
  `data(key)` passthrough, refreshing on data writes),
  `-text-offset` (non-negative, mapper-capable), `-text-margin-x/y`
  and `-text-rotation` (`none | autorotate`) — with the remaining
  text channels (font, color, boxes, opacity, transform,
  min-zoomed-font-size) shared with the main label, exactly v3's
  unprefixed reads.  Two more sidecar streams
  (`edgeSource`/`edgeTarget` in the widened `LabelStream` type) feed
  two more `GlyphBuffer`s from the same builder; the glyph word 13
  pad became the **endParam encoding** (sign picks the end,
  |v|−1 the arc offset — the +1 bias keeps offset 0 distinct from
  the midpoint streams).  The edge label VS re-anchors end glyphs by
  walking the drawn path — v3's `calculateEndProjection` on-GPU:
  straight/haystack segments exactly, bezier/loop as a 32-sample
  polyline of the quad chain (v3 itself walks a ~16-segment
  approximation), route families along the route polyline (v3's
  allpts walk — both ignore corner rounding) and multibezier at 8
  samples per quad chain link; autorotate takes the local tangent.
  The shared edge-glyph cull kind grows the viewport slack by half
  the chord for end glyphs (the anchor can sit anywhere on the
  path); two more `CulledGroup`s of the same kind and two more
  draws through the same `LabelPipeline` (its bind cache re-keyed
  per (uniform, stream)).  Edge removal and restyles clear the
  streams.  No label pixel parity vs v3 by recorded design — the
  pins are the `end-labels` golden (straight + bezier pair with
  autorotate + taxi + loop, boxed labels) and a `webgpu` spec
  asserting the straight-edge anchors land at v3's exact arc
  positions (boundary + offset) and slide on restyle.  8 Node specs
  (`test/gpu-end-labels.mjs`).  1944 Node tests, 113 Playwright
  specs, typecheck + lint green.  **Round 13 complete.**

**Sequencing**: pass 12c (the round-12 plan above) runs first, then
this round's phases in order — the 2026-07-29 triage keeps (ghost,
overlay/underlay) lead, per the discussion that produced this plan.
Process: the round-10 rules verbatim (isolated commits, docs
in-commit, full verify per item, escalation to "Needs a call" on any
real API-semantics question discovered mid-implementation; goldens
regenerated autonomously when a visual change is intended).

**Tier discipline** (the existing invariants, applied to the new
channels):

- Colors and opacities are *paint*: fragment-stage fetch, eligible
  for the GPU mapper eval kernel and paint tweens where the packing
  fits, always CPU-evaluable.
- Anything read by bb/fit, the CPU pick replica, or a columnar scan
  is *geometry*: eagerly CPU-evaluated, with its bounds/pick
  consumers extended in the same commit — `corner-radius` is read by
  the CPU pick inside-test; node `outline-width`/`-offset`,
  overlay/underlay padding and ghost offsets grow the store bb scan
  the way `border-width` already does.
- List props are constants-only (the 12b scope rule: a mapper value
  is one number/keyword, not a list), capped where they feed
  fixed-iteration shader loops, caps recorded as deviations.

**Implementation leans recorded at planning** (so the passes can run
autonomously):

- Gradients interpolate in **sRGB**, matching v3's canvas gradients —
  the live parity harness is the point of porting them.  (OKLab stays
  the default for *mapper* ranges; a gradient is a v3-parity visual,
  not a data encoding.)
- `font-style`/`font-weight` follow the `font-family` rule: global
  constants (one font per atlas); per-element forms stay out.
- Dashed `border-style`/`outline-style`/`text-border-style` stay out
  (dashing an SDF boundary needs perimeter parameterization — the
  recorded B2 reason); these props ship with `solid` semantics only
  where the rest of their group lands.
- `text-valign`/`text-halign` are placement only: labels stay
  excluded from `boundingBox()` (the recorded deviation), so the
  anchor grid carries no bb implications.
- Arrow scalars are draw-only in v4 (arrows are not pickable and not
  in bb — both existing recorded deviations), so `arrow-scale`/
  `arrow-width`/`arrow-fill` are pure FS/quad-sizing work.

**Phase A — the 2026-07-29 triage keeps** (direction already set)

- [x] **A1 Ghost props** (`ghost`, `ghost-offset-x/y`,
  `ghost-opacity`) — the decided simplified form: one extra instance
  draw of the basic node body (shape, border, background) at the
  offset, never labels or decorations.  Offsets grow the bb scan
  (geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **A2 Overlay/underlay theming** — the 10 `overlay-*`/
  `underlay-*` element props plus the `active-bg-*` and
  `selection-box-*` core props; the baked-in affordances (shader
  hover/active brighten, accent ring, DOM selection box) become the
  styled defaults.  Overlay/underlay padding grows bounds (geometry
  tier); underlay draws under the node within the existing pass
  order.  Landed 2026-07-31 in three slices — see the round-13
  record.

**Phase B — paint & stroke channels** (pure FS + channel plumbing)

- [x] **B1 Opacity split**: `background-opacity`, `border-opacity`,
  `line-opacity`, `text-opacity` — v3 semantics (element `opacity`
  is the master multiplier; effective = opacity × channel opacity).
  Early-z's guaranteed-opaque predicate consumes the product (more
  conservative, never wrong); text opacity folds into glyph alpha
  and reads back folded (the outline/background-opacity precedent).
  Landed 2026-07-31 — see the round-13 record.
- [x] **B2 `border-position`** (inside | center | outside — a pure
  SDF band offset) + **`corner-radius`** (a scalar channel feeding
  the existing round-rectangle SDF; CPU pick inside-test reads it —
  geometry tier).  Landed 2026-07-31 — see the round-13 record.
- [x] **B3 `line-cap`** (butt | round | square — endpoint cap SDF in
  the edge FS) + **`line-dash-pattern`/`line-dash-offset`**
  (arbitrary patterns over the existing arc-length varying;
  constants-only lists, pattern length capped).  Landed 2026-07-31 —
  see the round-13 record.
- [x] **B4 Edge casing**: `line-outline-width`/`-color` — a border
  band on the edge strip (straight and curved), colors fetched
  fragment-side.  Landed 2026-07-31 — see the round-13 record.
- [x] **B5 Node `outline-*`**: `outline-color`/`-opacity`/`-width`/
  `-offset` as an SDF band outside the shape (distance ∈
  [offset, offset + width]); solid only.  Bb scan and conservative
  bounds grow by offset + width; the pick body stays the shape
  itself (v3-consistent).  Landed 2026-07-31 — see the round-13
  record (the band derives as offset/2 past the border's outer
  edge, matching v3's scaled-path stroke exactly for circles).
- [x] **B6 Label box parity**: `text-transform` (none | uppercase |
  lowercase, applied when the glyph run is built),
  `text-border-width`/`-color`/`-opacity` (a border on the existing
  text-background quad), `text-background-shape` (rectangle |
  round-rectangle on the quad's SDF).  Landed 2026-07-31 — see the
  round-13 record.
- [x] **B7 Arrow scalars**: `arrow-scale`, `arrow-width`,
  `arrow-fill: hollow` (an FS ring test on the existing arrow SDFs).
  Compound arrow shapes stay out (recorded in round 10 B4).  Landed
  2026-07-31 — see the round-13 record.

**Phase C — re-triaged: 12a/12b built the machinery** (these sat in
needs-a-call batches; this plan's sign-off pulls them onto the
shelf, since the expensive part now exists)

- [x] **C1 Mid-arrows** (landed 2026-07-31 — see the round-13
  record): `mid-source-*`/`mid-target-*` arrow props —
  anchored at the curve/route midpoint with the midpoint tangent,
  exactly the anchor + frame edge labels and autorotate already
  compute in the VS (straight edges use the chord midpoint).  One
  more quad per enabled end off the edge cull streams.
- [x] **C2 Gradients** (landed 2026-07-31 — see the round-13
  record): `background-fill` (linear-gradient |
  radial-gradient) + `background-gradient-stop-colors`/
  `-stop-positions`/`-direction`; `line-fill` +
  `line-gradient-stop-colors`/`-stop-positions`.  Stop lists
  constants-only and capped (cap recorded); node FS evaluates along
  the gradient frame, edge FS along the arc-length varying; sRGB
  interpolation per the lean above.
- [x] **C3 `shape-polygon-points`** (landed 2026-07-31 — see the
  round-13 record) (custom polygon): the
  per-element unit point list lives in a blob (the curve-blob
  storage pattern, round-11 compaction rules), the node FS runs the
  generated sdPolygon loop over the blob range, and CPU pick runs
  point-in-polygon over the same points — dual consumers of one
  record, agreeing by construction.  Unit points are normalized, so
  the bb term stays the node box.

**Phase D — label props with recorded constraints**

- [x] **D1 `font-style` + `font-weight`** (landed 2026-07-31 — see
  the round-13 record) as global constants (the
  `font-family` rule: one font per atlas; a change resets the atlas
  and re-lays-out every label).
- [x] **D2 Per-element `min-zoomed-font-size`** (landed 2026-07-31 —
  see the round-13 record): a sidecar channel
  baked per glyph run, tested in the glyph cull predicate beside the
  global `labelFadePx`/`labelMinPx` (which stay the defaults).
- [x] **D3 `text-valign`/`text-halign`** (landed 2026-07-31 — see
  the round-13 record) for node labels: v3's 3×3
  anchor grid, anchor math off the node half-extents
  (`node.outerHalf` is already a bindable column); placement only
  per the lean above.
- [x] **D4 `source-label`/`target-label` families** (10 props;
  landed 2026-07-31 — see the round-13 record): two
  more glyph streams from the round-10 B5 template, anchored at
  v3's offsets along the edge (`source/target-text-offset` as arc
  distance via the route evaluator), each with its own margins and
  rotation per v3.  The chunkiest item — last for a reason.

**Excluded from this round, with reasons** (each stays in its parked
tier; none of these is newly decided): dashed
border/outline/text-border styles (perimeter parameterization);
`round-*` polygon variants, `cut-rectangle`, `barrel`,
`concave-hexagon`, `right-rhomboid`, `bottom-round-rectangle` (no
closed form under anisotropic scale — recorded in round 10 B1);
multiline props (`text-wrap`, `text-max-width`,
`text-justification`, `line-height`, `text-overflow-wrap`,
`text-metrics`, `box-select-labels` — their round designs label bb);
the `background-image` family (texture-atlas architecture call);
pie/stripe (wanted-at-all call); the compound group; `z-index` props
(coupled to the compaction draw-order call); `transition-*`
(animation-surface call); `display`/`visibility` split,
`events`/`text-events`, `box-selection: overlap` (interaction
calls); and everything in the dropped-by-decided-design ledger.

**Verification per item**: parse/readback/mapper Node specs; a
golden scene per visual group; live v3-parity scenes where the
visual is v3-comparable (gradients, casing, caps, mid-arrows, the
valign grid); the WGSL identifier/validation guards as usual.  The
renderer benchmark re-runs only for items touching hot paths (B1's
early-z predicate, C2's node-FS cost).

## Round 14 plan — compound nodes (planned 2026-07-31)

The head of the design queue: parent/child hierarchy, auto-sized
parent nodes, compound draw order, ancestor-gated visibility/opacity,
event bubbling, compound loop edges, and the compound
style/query/API surface.  Design discussed and signed off in one
sitting (2026-07-31); this section records the calls and the pass
split so the round can run under the round-10 process rules
(isolated commits, docs in-commit, full verify per item, escalation
on any new API-semantics question).  Two process amendments,
user-set for this round: **docs land first** (this plan section and
the README pointer are their own commit before any implementation),
and each item is **tests-first** — its specs are written and seen
red before the implementation brings them green, landing together as
the item's isolated commit so every commit on `v4` stays green.

**Signed-off design calls:**

1. **Parent styling takes both decided forms.**  (a) The sheet gains
   a **`parents` group** overlaying the nodes group for parent slots
   — constants or mappers, defaults = v3's `:parent` block
   (`shape: rectangle`, `padding: 10`, `background-color: #eee`,
   `border-width: 1`, `border-color: #ccc`).  (b) The `case`
   mapper's `when` gains **structural boolean conditions**
   (`{ parent: true }`, `{ child: true }`).  Query objects gain the
   matching `parent`/`child` boolean keys.  The v3 `:parent:selected`
   tint is dropped — v4 never restyles on selection (the shader
   accent ring is the selection affordance); recorded deviation.
2. **Event bubbling is ported** (reversing v4's flat-emit rule for
   compounds only): element events bubble child → ancestors → core
   with v3 semantics — `event.target` stays the originator,
   `stopPropagation()`/return-`false` halts the walk.  The flat
   no-compounds path stays byte-identical (zero cost).
3. **Pass-1 scope**: hierarchy + traversal API + `move({ parent })`
   + remove-cascade + auto-bounds with padding + parents-under-
   descendants draw order + parent drag moves subtree + parent
   labels, **plus** ancestor-gated visibility, rendered
   effectiveOpacity (ancestor product), compound loop edges, and
   `min-width`/`min-height` as a **simplified centered clamp** —
   the four bias props (`min-width-bias-left/right`,
   `min-height-bias-top/bottom`) are dropped by decided design
   (their px-reinterpreted-as-percent rule and ratio normalization
   don't earn their surface; the centered clamp is exactly v3's
   default-bias behavior).  **Future-round note (user-set): revisit
   asymmetric parent spacing with a cleaner mechanism — e.g. four
   per-side padding props — rather than resurrecting the biases.**
4. **Dropped/recorded**: `z-compound-depth`/`z-index-compare` (the
   z-index round); `compound-sizing-wrt-labels: 'include'` throws
   (labels are excluded from bb in v4 — the prop parses,
   `'exclude'` is the only accepted value); the bias props and
   `:parent:selected` (above).

**Global decisions:**

- **Flag bits** (`contract.mts`; 4096+ free): `FLAG_PARENT = 4096`
  (has ≥1 child), `FLAG_CHILD = 8192` (has a parent),
  `FLAG_SELF_HIDDEN = 16384` (own display state).  **`FLAG_VISIBLE`
  is redefined as the *effective* shown bit** (own state AND no
  hidden ancestor) — every consumer (WGSL `SHOWN`, the cull
  predicates, `scanRefsInto`, `boundingBox`, CPU pick, and the edge
  kernels' both-endpoints-SHOWN tests) already reads it, so
  ancestor gating and edge gating land with zero shader or scan
  changes.  Store-managed derived bits follow the `FLAG_CURVED`
  precedent.
- **Parent geometry is materialized into the real
  `node.size`/`node.position` columns** by a lazy pull-based flush
  (the CurveIndex pattern), so bb, cull, pick, `refsInBox`, the
  mirror and all shaders need zero geometry changes.
  `GraphStore.flushDerived()` = `hierarchy.flush()` then
  `curves.flush()`, replacing every `curves.flush()` call site —
  hierarchy first, because curve derivation (loops, compound loops,
  endpoint math) reads the sizes/positions the hierarchy flush
  writes.
- Verified at planning: no `StyleEngine.dependsOnSelection` exists
  at HEAD (it left with the selector removal) — the parent-flip
  restyle hook is built fresh; and v3 edge `effectiveOpacity` is the
  edge's own opacity (edges have no parent), which v4 ports.

**Design (per subsystem):**

- **HierarchyIndex** (`store/hierarchy.mts`, new; modeled on
  `store/curve-index.mts` — host-callback object, pending sets,
  `flush()`).  State: `parent: Int32Array` (−1 = orphan) +
  `parentGen` (recycle safety; mismatch ⇒ orphan + warn-once),
  `children: Map<slot, slot[]>`, `depth: Uint16Array`,
  per-parent CPU style inputs (`padding`, unit, `relativeTo`,
  `minW/H`, fallback size), `baseOpacity` (pre-fold), resolved
  padding cache, `pendingParents`, `parentCount`, `orderDirty`.
  `setParent` cycle-guards by ancestor walk (cycle ⇒ warn + no-op,
  v3), maintains children/depth/flags, marks old+new chains
  pending, invalidates the subtree's incident edges in the
  CurveIndex, and fires the style flip + structural-case refresh
  hooks.  `flush()` expands pending to ancestors, sorts
  **depth-descending** (children-before-parents replaces
  recursion), computes direct-children bb from raw columns
  (skipping effectively hidden children), applies padding (px or %
  of children-bb w/h/average/min/max), the min-size centered
  clamp, and the degenerate-children fallback (stylesheet size at
  the stored position), then writes through `materializeGeom` —
  raw column writes + dirty marks + `updateOuterHalf` +
  `geoEpoch++` + label re-anchor when size changed + incident-edge
  curve invalidation.  `materializeGeom` **bypasses
  `setPosition`**, so no child shift and no re-marking: flush
  cannot re-enter itself.
- **Parent `setPosition`** (public path): shift all descendants by
  the delta via raw writes (locked children move too — v3), write
  the parent, mark only its *ancestors* pending (uniform subtree
  translation keeps its own derived center exact).  The bulk
  position writers and `shift`/`positions` gain v3's dedupe rule:
  skip elements whose ancestor is also in the written set.
- **Flush triggers**: the four position writers (slots with
  `FLAG_CHILD`), size/border writes (beside the `updateOuterHalf`
  hooks), add/remove/reparent, compound style writes, visibility
  toggles.  Drained from `flushDerived()` at `takeDelta` (before
  mirror sync), `boundingBox`, `refsInBox`, the collection bb
  sites, and the pick entry.
- **GPU tween demotion**: a position animation whose slots include
  any `FLAG_CHILD`/`FLAG_PARENT` node is not GPU-eligible (a GPU
  lease leaves CPU positions stale ⇒ stale auto-bounds; a tweened
  parent must shift children per tick).  Reparenting while a GPU
  position tween is live settles all active GPU position tweens to
  the CPU (rare structural op; recorded).
- **Draw order / cull / pick**: a new `parentNode` cull kind whose
  input iteration is a CPU-maintained permutation (`parentOrder`,
  parents sorted by (depth asc, slot asc), rebuilt on hierarchy
  change — compaction preserves input order, so parents paint
  shallow-under-deep); bindings positions + outerHalf + flags +
  parentOrder (+3 outputs) = 7/8.  The existing `node` cull
  predicate excludes `FLAG_PARENT` (flags already bound), which
  also removes parents from the **depth prepass** — mandatory,
  since a prepass-written parent interior would early-z-kill the
  edges/children that must draw over it (parents lose the early-z
  benefit; recorded — they are few and flat).  `drawScene` draws
  parent bodies right after the prepass, before edge underlays,
  reusing the main node pipeline.  Parent
  ghost/underlay/overlay/label bands keep their existing post-edge
  positions — recorded z deviations deferred to the z-index round.
  CPU pick becomes two passes mirroring draw order: leaves
  descending (skip `FLAG_PARENT`), then parents in reverse
  `parentOrder`, with a shared order helper so pick and draw can't
  diverge.  Dragging a parent needs no drag-set union (parent
  `setPosition` shifts the subtree); `FLAG_GRABBED` is not set on
  descendants (minor recorded deviation).
- **Visibility + opacity folds**: `setVisibility` sets/clears
  `FLAG_SELF_HIDDEN` and recomputes effective `FLAG_VISIBLE` over
  affected subtrees (pruned walk), marking parents pending (hidden
  children leave the bb).  `visible()` reads the effective bit;
  the display readback reads `!FLAG_SELF_HIDDEN`.  `node.opacity`
  stores the **effective** value (`base × ∏ ancestor bases` — the
  round-13 B1 fold pattern, with the base tracked CPU-side); a
  parent's opacity write refolds its subtree, gated on
  `parentCount > 0` so the non-compound path is unchanged.
  `style('opacity')` reads the base; `effectiveOpacity()` the fold.
  GPU-mapped node `opacity` (and `width`/`height`) demote to CPU
  while compounds exist (the kernel would overwrite the fold;
  auto-size owns parent sizes).
- **Bubbling**: phase-based fan-out in `core._emitOnEle` — flat
  mode (no compounds, or orphan/edge target) is exactly today's
  single emit; phased mode emits per chain element child →
  ancestors → core, checking `isPropagationStopped()` between
  phases (the shared emitter's existing machinery).  Ref-qualified
  listeners match the phase ref; predicates run against the phase
  element; unqualified listeners match only the core phase (still
  fire exactly once).  `callbackContext` returns the phase element
  (v3's currentTarget); `event.target` stays the originator.
- **Style/query**: `SHEET_KEYS` gains `'parents'`; the block takes
  node props plus `padding`, `padding-relative-to`, `min-width`,
  `min-height`, `compound-sizing-wrt-labels`.  The engine holds a
  second computed-const record (nodes overlaid with the parents
  block); apply picks by `FLAG_PARENT`; parent `width`/`height`
  divert to the fallback size (auto-bounds owns `node.size`).  The
  parent-flip hook re-applies the flipped slot's constants,
  re-bakes its label entry, transfers width/height ownership both
  ways, and refreshes structural case deps (pseudo-keys
  `'::parent'`/`'::child'` in the deps map).  Matcher: `parent`/
  `child` boolean keys OR-composed into the flag test like
  `selected`; `group: 'edges'` + a structural key throws.  Any
  channel where the parent overlay differs while GPU-mapped
  demotes to CPU.
- **Compound loop edges**: the CurveIndex host gains
  `relation(a, b)` from the hierarchy; ancestor/descendant edges
  (and parent self-loops) derive a `CURVE_MULTI`-family blob
  record with v3's `findCompoundLoopPoints` math verbatim (two
  control points off the min top-left corner, `loopW = 50`,
  per-end stretch `max(0.5, log(w·C))`), box-bounded
  (`FLAG_CURVED_BOX`).  Applies regardless of declared curve style
  (v4 has no `edge:compound` selector — mirrors the forced
  self-loop rule; recorded).  Re-derives on reparent and on
  endpoint resize during hierarchy flush.
- **Model/API/format**: `parent` becomes a reserved first-class
  key — skipped by def/columnar data ingest, immutable via
  `data()` (reparent via `move()`), synthesized on read like edge
  `source`/`target`.  Def ingest resolves `parent` in a second
  pass after the batch's nodes exist (forward refs OK; unknown
  parent ⇒ warn + orphan, v3).  Wire format: version bump +
  optional nodes parent section (u32 index, sentinel);
  `GpuColumnarNodes.parent?`.  Collection: the full traversal
  surface (slot-native), `remove()` cascade over descendants,
  identity-preserving `move({ parent })` with `moveout`/`move`,
  compound-relative `relativePosition`, real `padding()`, and
  **parent `width()` readback subtracts 2·padding** (the column
  stores the padded/drawn size; `paddedWidth()` returns the
  column) — v3 parity.  `cy.hasCompoundNodes()` goes live.
  Layouts position non-parents only; `boundingBoxAt`
  force-derives.

**Pass split** (tests-first per item; each lands green as its own
commit(s) with docs in-commit):

- [x] **14.0 Docs-first** — this plan section + the README pointer
  (landed as its own commit before any implementation, per the
  user-set process amendment).
- [x] **14.1 Hierarchy model** — landed 2026-07-31.
  `FLAG_PARENT`/`FLAG_CHILD` (contract bits 4096/8192, node-only,
  store-managed like `FLAG_CURVED`); `store/hierarchy.mts` — the
  `HierarchyIndex` (host-callback object like the CurveIndex):
  `parent: Int32Array` (−1 = orphan) + link-time `parentGen`
  (recycle guard, warn-once), sparse `children` lists, `depth`,
  live-parent count, and the lazily-rebuilt `parentOrder()`
  (depth-asc, slot-asc) draw permutation.  `setParent` cycle-guards
  by ancestor walk (warn + no-op, v3's dropped-ref rule), maintains
  flags/depths (subtree walk on reparent) and no-ops on same-parent
  writes; `removeNode` now throws while children remain (the 14.2
  collection cascade removes them first) and severs the node's own
  link.  Store delegates (`setParent`/`parentOf`/`childrenOf`/
  `depthOf`/`isAncestorOf`/`parentCount`/`hasCompounds`/
  `parentOrder`); `cy.hasCompoundNodes()` is live.  The `parent`
  data key is **reserved first-class**: def ingest skips it (14.2
  resolves it as hierarchy), `data('parent', v)` throws (reparent
  is `move()`), and reads synthesize from the hierarchy like edge
  `source`/`target` (whole-object `data()` includes `parent` only
  when parented).  Tests-first: 12 specs in
  `test/gpu-hierarchy.mjs` written red, then green — 1956 Node
  tests, typecheck + lint clean.
- [x] **14.2 Collection API + lifecycle** — landed 2026-07-31.
  Slot-native traversal on the hierarchy: `parent` (always a proper
  collection — v3's raw-ref single-element shortcut and its
  ignored-selector wart are not ported), `parents`/`ancestors`
  (level-by-level, nearest first), `children` (link order),
  `descendants` (pre-order), `siblings` (via
  parent().children() − self; orphans are nobody's siblings),
  `orphans`/`nonorphans` (filters of the calling collection),
  `commonAncestors` (closest first; an edge member empties the
  result, v3), and the `isParent`/`isChildless`/`isChild`/
  `isOrphan` predicates (booleans, first-element semantics).
  Lifecycle: `remove()` cascades over descendants + their incident
  edges (packed-seen closure; nodes removed depth-descending so the
  store's children-first rule always holds); `move({ parent })`
  re-parents in place — identity preserved, `moveout` before /
  `move` after per changed node (listener-gated), unknown parent a
  silent no-op (v3), cyclic assignment warns + drops with no
  events; def ingest resolves `data.parent` in a second pass after
  the batch's nodes exist (forward refs in any order; numeric
  parents coerce to string ids; unknown/non-node parents warn +
  orphan — v3's silent-drop case upgraded to a warning); element
  `json()` carries `parent` via the synthesized data object and
  round-trips through `add()`.  Tests-first: 17 specs in
  `test/gpu-compounds-api.mjs` red then green — 1973 Node tests,
  typecheck + lint clean.
- [x] **14.3 Auto-bounds flush** — landed 2026-07-31.  Parent
  geometry is derived lazily and **materialized into the real
  `node.position`/`node.size` columns**, so bb/cull/pick/mirror
  need zero geometry changes.  `HierarchyIndex` gained the pending
  set (`markGeo` marks whole ancestor chains with early-exit;
  `markAncestors` for pure translations), per-parent compound
  style (`setCompoundStyle`: padding px/% + relative-to, min-w/h),
  and `flush()`: deepest-first over pending parents, direct
  children's border-inclusive extents off `node.outerHalf`
  (hidden children excluded — v3's display:none bb rule),
  % padding against the pre-clamp children bb (v3), the centered
  min clamp, and the degenerate fallback to the **stashed style
  size** at the stored position.  The stored size is the
  padded/drawn box: `width()`/`height()` readback subtracts
  2·padding (v3's autoWidth), `paddedWidth`/`paddedHeight` return
  the column, `outerWidth` = padded + border, `padding()` answers
  the resolved pad.  Writes go through `materializeParentGeom` —
  dirty spans, `updateOuterHalf`, the `nodeHalfMax` cull meter,
  `geoEpoch`, and a store-side **label re-anchor** (the sidecar
  entry's halign/valign reconstruct from its block-fraction
  shifts, so no engine round-trip) — and never re-mark: the flush
  can not re-trigger itself (spec-pinned).
  `GraphStore.flushDerived()` = hierarchy then curves, replacing
  every `curves.flush()` site; drains at takeDelta/bb/refsInBox/
  accessors.  Triggers: the four position writers (a parent
  `setPosition` flushes, then shifts its subtree by the delta —
  v3's beforePositionSet — with locked children moving too; bulk
  writers take per-slot sequential semantics under compounds),
  size/border writes (`markGeo`; a style size write on a parent
  also refreshes the stashed fallback), add/remove/reparent, and
  show/hide (hidden children leave the bb).  Collection:
  `shift()` gains v3's ancestor-in-set dedupe; parent moves emit
  `position` for shifted descendants (listener-gated, v3);
  compound-relative `relativePosition` (get + both setter forms);
  parent-flip restores the stashed style size.  Tests-first: 14
  specs in `test/gpu-compound-bounds.mjs` red then green (two
  real bugs caught red-green: the parent-move delta and the bulk
  shift both read pre-flush positions — both now flush first) —
  1987 Node tests, typecheck + lint clean.
- [x] **14.4 Ancestor visibility + effective opacity** — landed
  2026-07-31.  `FLAG_SELF_HIDDEN` (16384) records the element's
  own show/hide state; **`FLAG_VISIBLE` is now the effective shown
  bit** (own state AND no hidden ancestor) recomputed by
  `GraphStore.setVisibility` over affected subtrees with pruning
  (an unchanged effective bit means a consistent subtree) — every
  consumer (WGSL SHOWN, cull, scans, bb, CPU pick) reads the one
  bit unchanged, changed nodes mark their chains' auto-bounds
  stale, reparenting re-resolves the moved subtree, and a child's
  own hidden state survives parent toggles (v3).  `refsInBox`
  gained the drawn-edge rule (both endpoints shown — closing a
  pre-existing gap where a hidden endpoint's edges stayed
  box-selectable).  Effective opacity renders: the node opacity
  column stores `base × ∏ ancestor bases` (bases tracked sparsely;
  writes fold at setScalar, a parent's write refolds its subtree,
  reparenting refolds against the new chain, recycled slots
  drop their state), `style('opacity')` reads the base while
  `effectiveOpacity()`/`transparent()` read the fold, edges keep
  their own opacity (v3 — verified against v3 source), and a
  GPU-mapped node `opacity` demotes to CPU while compounds exist
  (`paintInputs` + a store→engine `onCompoundsToggled` paintVersion
  bump on the 0↔>0 transitions).  Tests-first: 11 specs in
  `test/gpu-compound-visibility.mjs` red then green — 1998 Node
  tests, typecheck + lint clean.
- [x] **14.5 Event bubbling** — landed 2026-07-31.  Element events
  on parented nodes now run in **phases** — origin → ancestors
  (child→parent) → core — implemented as `_emitOnEle` re-emitting
  **one shared Event** with a moving `_gpuPhaseRef`, so
  `stopPropagation()` (or return-`false`) carries between phases
  and halts the walk (v3).  Per phase: ref-qualified element
  listeners fire in their own element's phase with the callback
  context set to that element (v3's currentTarget) while
  `event.target` stays the originator; unqualified core listeners
  fire once, in the core phase; predicate listeners keep v3
  delegation semantics — once, against the originator, at the core
  (verified against v3's core-selector delegation, which also
  matches the target once).  Flat emits (no compounds,
  orphan/edge targets) never stamp the phase fields and take
  exactly the old single-emit path — byte-identical behavior and
  zero cost.  Within-phase order stays registration order (the
  recorded deviation narrows to within-phase only).  Tests-first:
  9 specs in `test/gpu-compound-events.mjs` red then green — 2007
  Node tests, typecheck + lint clean.
- [x] **14.6 Parents sheet group + compound props** — landed
  2026-07-31.  The sheet gains **`parents`**: channel props that
  overlay the nodes group for parent slots with v3's order-based
  precedence — the default `:parent` overlay (rectangle, #eee
  fill, 1px #ccc border) < user nodes block < user parents block
  (v3 applies blocks in order; the 14.9 parity scene caught the
  first cut assuming specificity ordering) — plus the
  compound props (`padding` px or 'N%', `padding-relative-to`,
  `min-width`/`min-height`, `compound-sizing-wrt-labels` where
  `'exclude'` is the only accepted value, `'include'` throws —
  labels are excluded from bb; compound props are constants-only
  and throw outside the parents group).  Padding defaults to v3's
  10.  Engine mechanics: a third GroupDef compiled from the merged
  props (parents-block mappers evaluate for parent slots only);
  `applyBulk`/`refreshMapped` partition node slots by
  `FLAG_PARENT`; mapper escalations re-partition via
  `allSlotsFor`; the readback paths route through `defFor(ref)`;
  `stylesDependOnData` consults the parents deps;
  `store.setCompoundStyle` lands per parent at apply.
  **Flip restyle**: a leaf↔parent flip re-applies the slot against
  the right group via a store `onParentFlip` hook (defaults differ,
  so flips always visibly restyle — v3); parent style width/height
  keep flowing into the stashed fallback (the 14.3 ownership
  rule).  **GPU demotion**: channels the parents overlay resolves
  differently (the default overlay's background/border colors, any
  user parents-block prop) demote a nodes-group GPU mapper to the
  CPU path while compounds exist — the kernel evaluates every
  slot and would repaint parents with the nodes value.  Readback:
  compound props answer from the per-parent record (leaves read
  the zero defaults).  Tests-first: 9 specs in
  `test/gpu-parents-style.mjs` red then green; the 14.3 bounds
  suite pins raw math by zeroing the new defaults in its sheet —
  2016 Node tests, typecheck + lint clean.
- [x] **14.7 Structural query + case keys** — landed 2026-07-31.
  Query objects gain **`parent`/`child` booleans** (`parent: false`
  = v3's `:childless`, `child: false` = `:orphan`), OR-composed
  into the one flag test like `selected` — pure columnar scans, no
  `scanRefsInto` changes.  Structural keys are node concepts: an
  explicitly-edges query throws, an unrestricted one just never
  matches edges (v3's pseudo semantics).  The `case` mapper's
  `when` gains the structural forms `{ parent: bool }` /
  `{ child: bool }` — a structural condition stands alone (AND it
  with data conditions via the `when` array form) and compiles to
  the reserved `'::parent'`/`'::child'` keys the engine's value
  reader answers from the hierarchy flags, so deps registration,
  evaluation and refresh all reuse the data-condition machinery
  verbatim.  A reparent fires a pseudo-key `refreshMapped` on the
  moved node (`store.onReparented`); parent flips already restyle
  fully via 14.6's hook.  Tests-first: 8 specs in
  `test/gpu-structural-query.mjs` red then green — 2024 Node
  tests, typecheck + lint clean.
- [x] **14.8 Wire + columnar parent sections** — landed 2026-07-31.
  `GpuColumnarNodes.parent?: Uint32Array` — payload node indices,
  `NO_PARENT` (0xffffffff) sentinel — with `toColumnarElements`
  lifting def parents into it (unknown in-payload parents warn +
  orphan; the parent key never lands in the data columns), bulk
  store ingest linking after the flags fill (out-of-range indices
  throw the self-contained rule; cycles ride the setParent guard —
  the first payload link holds, the closing link warns + drops),
  and the wire format gaining the node-parent section (flag 512,
  written right after positions).  Wire **version bumps to 3**;
  the reader accepts 2–3 (a v2 buffer can never carry the parent
  flag, so old payloads load unchanged — spec-pinned by
  re-stamping a compound-free v3 buffer as v2).  `cy.serialize()`
  flushes derived geometry and exports the live hierarchy as
  payload indices (second pass — a parent may sit later in slot
  order than its children), round-tripping selection + positions +
  parents.  Tests-first: 7 specs in `test/gpu-compound-wire.mjs`
  red then green — 2031 Node + 60 module tests, typecheck + lint
  clean.
- [x] **14.9 Parent draw stream, cull, pick** — landed 2026-07-31.
  Parent bodies draw in their own stream right after the depth
  prepass (under every edge layer — v3's compound order), off a
  new `parentNode` cull kind whose input iteration is the
  CPU-built (depth asc, slot asc) permutation: the compaction
  scaffold's write expression is now parameterizable, and the
  parent kernel writes the *permuted* slot, so its visible list is
  already in paint order (outer parents under inner ones) with
  zero sorting on-GPU.  Bindings: positions/sizes/flags/
  borderWidths + the parentOrder buffer (uploaded only when the
  hierarchy's order object changes identity) at exactly the
  8-storage budget, with the ghost cull's conservative extent tier
  (full border + the frame outline slack).  The main `node` cull
  (and with it the depth prepass) excludes `FLAG_PARENT` — flags
  were already bound, zero new bindings — which is also what keeps
  early-z from killing the edges/children that draw over parent
  interiors (parents lose the early-z benefit; recorded — few and
  flat).  CPU pick became two passes mirroring draw order: leaves
  descending, then parents in reverse permutation (deepest wins),
  so a parent can never swallow its children's picks; the pick
  entry and export/serialize paths flush derived geometry first.
  **Two real bugs caught by the new harness**: the renderer's
  init-time mirror full-upload ran before the hierarchy flush
  (the exact 12a init-order lesson re-hit — parents rendered at
  their pre-derive columns; init now calls `flushDerived()`), and
  14.6's specificity assumption was wrong — **v3 precedence is
  order-based**, so a user nodes block overrides the default
  `:parent` overlay (the parity scene showed v3 parents in the
  user node color; the merge order and GPU-demotion set were
  corrected, with the parents-style suite re-pinned).  Verifies:
  3 new compound CPU-pick specs, a `webgpu` behavioral spec
  (child-over-parent pixels, padding band, edge-over-parent, pick
  in band vs child, parent follows child), the `compounds` golden
  (nesting/padding/borders), and the `parity-compounds` live v3
  scene at **2.09%** under a 3% bound — the residual is a
  recorded deviation: v3's node bb includes the border's
  miter-corner overshoot (~(√2−1)·border/2 per side on cornered
  shapes), which compounds inherit as slightly larger parent
  boxes with bordered children; v4's child extents are the plain
  border-inclusive `outerHalf`.  Full suites: 2034 Node tests,
  116/116 Playwright (54+3 `webgpu`... all pre-existing goldens
  byte-stable), typecheck + lint clean.
- [x] **14.10 Compound loop edges** — landed 2026-07-31.  An edge
  between a node and its own ancestor/descendant (or a self-loop
  on a parent) routes around the outside — v3's
  `findCompoundLoopPoints` verbatim (two controls off the
  endpoints' min top-left corner, `(1 + 50^1.12/100)·dist·(j/3+1)`
  offsets, stretch `max(0.5, ln(outerWidth·0.01))` per end) — as a
  new **`CURVE_CMPD` kind** rendered exactly like a loop (two C1
  quadratics through the control midpoint) with control points
  evaluated from **live** positions/outer halves in both
  implementations, so drags and auto-bounds resizes follow with
  zero re-derivation.  Routing applies whatever the declared curve
  style (v3's `edge:compound` default block makes related edges
  bezier-compound by default, so behavior matches; unbundled
  styles take `control-point-distances[0]` and j = 0 — v3).
  Derivation rides the CurveIndex: a relation is a pair-map build
  trigger (bundle indices), reparenting invalidates the moved
  subtree's incident edges, leaf↔parent flips re-route self-loops,
  and `flush()` loops until settled (a per-edge derivation that
  discovers a relation hands its pair back).  Cull: box-bounded
  (`FLAG_CURVED_BOX`) plus a derivation-time excursion bound in
  `curveSlack` (2× stretch margin — stretch grows only
  logarithmically with node size; parent resizes refresh the
  bound; recorded).  **Two kind-space traps found**: the WGSL
  analytic-vs-route dispatch (`params.w <= 2.0`) sent the new kind
  into the blob-route path — six dispatch sites now special-case
  it (the first golden run caught taxi-like garbage) — and
  `CURVE_HAS_ENDPT = 8` collided with the naïve next kind id, so
  `CURVE_CMPD = 16` sits above the endpoint-flag range with a
  contract note (raw-kind tests only, before any strip).
  Verifies: 9 Node specs (`test/gpu-compound-loop-edges.mjs`,
  v3-formula control points, relation lifecycle, slack/flags,
  live resize), the `compound-loops` golden, and
  `parity-compound-loops` live vs v3 at **0.022%** (the
  outside-to-line vs outside-to-node endpoint difference is
  invisible at this scale).  2043 Node tests, 118/118 Playwright,
  typecheck + lint clean.
- [x] **14.11 Interaction + tween demotion + layouts** — landed
  2026-07-31.  **Layouts position leaves only** (v3):
  `layoutPositions` filters parents (auto-bounds derive them from
  their placed leaves), the grid slot path filters `FLAG_PARENT`
  slots, the grid handle path / circle / concentric / breadthfirst
  filter their node lists, and preset skips parent entries in both
  forms (a preset parent write would shift its whole subtree).
  `boundingBoxAt` skips parent bodies — the leaves' hypothetical
  boxes stand in; the padding margin is not modeled (a recorded
  fit-target approximation).  **GPU tween demotion**: a position
  animation whose node targets carry `FLAG_PARENT|FLAG_CHILD` is
  not GPU-eligible (a lease would leave the CPU columns the
  auto-bounds derivation reads stale, and a tweened parent must
  shift its subtree per tick — CPU-only semantics); unrelated
  leaves in compound graphs stay eligible.  **Reparent settle**:
  `AnimationManager.settleGpuAll()` (factored from detachDriver)
  runs from the store's reparent hook, so live leases settle to
  the CPU before the moved slots fall under CPU-side derivations.
  **Interaction needed no pointer changes**: a parent drag is just
  `position()` (the 14.3 subtree shift), and drag-all-selected
  with a parent + its child rides the collection `shift()` dedupe.
  Tests: 6 Node specs (`test/gpu-compound-layouts.mjs`) + a
  Playwright drag spec (parent-band drag moves the subtree by the
  pointer delta; a selected parent+child pair moves exactly once).
  2049 Node tests, 119/119 Playwright, typecheck + lint clean.
- [x] **14.12 Debug scene + benchmarks + true-up** — landed
  2026-07-31.  `debug/webgpu` gained a `?network=compound`
  generated scene (clustered leaves under ~N/20 parents, every 4th
  parent nested, intra-cluster edges plus a sprinkle of
  child→parent compound loops).  **`benchmark/gpu/compound.mjs`**
  (Mitata, v3 vs v4 at BENCH_N; instances torn down after the run —
  v3 compound instances leave live timers behind): at N = 2k,
  parent drag (subtree shift + bb settle) **263×** v3 (1.14 µs),
  child drag + parent re-derive **59×** (1.50 µs), reparent
  round-trip **142×** (0.64 µs).  **Flush cost at scale** (200k
  leaves under 1 000 parents, 200 children each, 200k edges;
  direct measurement): init 1.81 s, a full re-derive of all 1 000
  parents **2.7 ms**, a parent-drag frame (200-child subtree shift
  + flush + delta) **17.6 µs**, a child-drag frame **11.8 µs** —
  auto-bounds are noise at frame rate.  **Renderer benchmark**
  gained `gen-25k-compound` (25k × 50k under 1k parents, leaves
  clustered per parent — scattered members would make every parent
  span the whole graph, overdraw rather than a representative
  scene): on this box (RX 580, dpr 2, scale 1) the gpu side holds
  **vsync (16.7 ms wall p50) in every scenario** — fit-all,
  zoomed-in, far-zoom, labels on — while v3 canvas runs ~2 s/frame
  fit-all and ~240 ms zoomed-in; init 296 ms vs 5.1 s.  Final docs
  true-up in this commit.  **Round 14 is complete.**

**Risks tracked per item**: flush re-entrancy (raw-column reads
only); parent `width()` readback consistency across style/bb APIs;
recycled parent slots (gen guard); leaf↔parent flips (size
stash/restore, label re-anchor); deep-nesting drag cost
(`markChildGeo` early-exit; the benchmark item guards it);
mid-tween reparent settle; parent decoration bands above edges
(recorded, z-index round); the shared pick/draw order helper; wire
backward compat (optional section).

## Design sitting (2026-08-01) — z-index dropped; rounds 15–18 scoped

Decided with the user in one sitting.  Every round below runs under
the round-10 process rules plus the round-14 amendments, now standing
policy: **docs land first** (each round's 0-item commits its plan
section + README pointer before any implementation) and every item is
**tests-first** (specs written and seen red before the implementation
brings them green, landing together as the item's isolated commit).

**The z-index call — dropped outright.**  v4 ships no `z-index`, no
`z-compound-depth`, no `z-index-compare`, and no built-in grab-raise
either.  Reasoning, recorded: element stacking is a document/UI
concept without a strong graph use case — node overlap is a layout
artifact rather than an authored arrangement, layered emphasis is
already served structurally (parents under edges under leaves under
labels; overlay/underlay props; opacity dimming), and v3 carried the
prop triple at the cost of a whole-scene comparator sort per frame.
The compound worry raised in the sitting (edges into child nodes must
stay visible) is already answered by the round-14 stream split:
parent *bodies* draw under all edges, leaves above them.
Consequences, now permanent (all were already recorded deviations):
draw order is structural + slot order within a stream; a grabbed node
does not pop above later-inserted nodes; parent decorations
(ghost/underlay/overlay/label bands) keep their post-edge positions.
`sortByZIndex`/`zDepth` close with the props.  The only logged future
extension, if real demand ever appears, is a single boolean
**elevated tier** (one extra batch per group drawn over the leaf
stream) — never arbitrary integer stacking; logged, not planned.

**Queue after the sitting**: background images (round 15) →
multiline labels + label bb (round 16) → event vocabulary + the
extension contract (round 17) → GPU force layout (round 18).

## Round 15 plan — background images (planned 2026-08-01)

The 16-prop `background-image` family — the "sleeper third" pillar of
the 2026-07-29 sweep (near-universal in production apps).  All calls
below signed off in the 2026-08-01 sitting.

**Signed-off design calls:**

1. **Storage is size-tiered texture arrays with hardware mips** —
   not a shelf atlas, not batch-per-image.  Unique images dedup by
   URL into an `ImageRegistry` (the string-dictionary discipline:
   refcounted entries, round-11 waste-threshold reclaim); each image
   rasters into a layer of a per-tier `texture_2d_array` (128² /
   512² / 1024², rgba8, full mip chain generated at upload), native
   w/h kept per entry for UV/aspect math.  Layers are slots:
   free-list alloc/reclaim, growth by realloc-copy.  Rationale from
   the sitting, recorded: mips make minification *cheaper* as well
   as crisper (coherent low-mip reads vs scattered full-res texels —
   an unmipped atlas is a bandwidth spike at far zoom); array layers
   churn and grow like every other store structure, where a shelf
   atlas fragments toward a repack-the-world cliff; and the draw
   stays one instanced call per stream (batch-per-unique-image was
   ruled out — it breaks the cull → indirect-draw shape).  Cap:
   images raster at most at the top tier (1024²; the `imageMaxSize`
   renderer option moves the cap) — a recorded deviation for large
   photo sources.

2. **Full-color SVG stays crisp by zoom-promotion.**  A vector
   source has no native resolution, so a fixed raster is our
   artifact: per unique SVG the renderer tracks the max on-screen
   device-px demand among visible users (a CPU-side max over unique
   images riding existing per-frame state) and, when demand exceeds
   the current raster by ~1.5× (with hysteresis), re-rasters into
   the next tier asynchronously and swaps the (tier, layer) ref —
   momentary softness that self-corrects, the glyph-atlas
   `loadingdone` precedent.  Promotion ends at the cap tier
   (recorded blur past it).  Raster sources never promote (source
   resolution is their ceiling, as in v3).  **Exports re-raster**:
   `png()`/`jpg()` raster visible SVG images at the export scale
   before encoding (the export path is already async), preserving
   the WYSIWYG guarantee at high `scale`.

3. **SDF icon mode — the glyph trick, generalized.**  A large class
   of node images (SBGN glyphs, icon sets) are monochrome
   silhouettes — glyph-shaped data.  The per-image
   `background-image-type: 'auto' | 'sdf-icon'` (explicit, never
   sniffed — detecting "really monochrome" SVGs is fragile) sends
   `sdf-icon` sources through the glyph pipeline: one raster at
   128², the glyph atlas's exact EDT, a single-channel r8 array
   layer (~16 KB vs ~1.3 MB for a 512² rgba mip chain), rendered by
   threshold + fwidth AA — **crisp at every zoom** with no promotion
   machinery — and tinted at render time by
   `background-image-color` (the label-color precedent), which makes
   icon color mapper-drivable.  Recorded: a multi-color source in
   icon mode collapses to its alpha-thresholded silhouette in one
   color — well-defined, documented; full-color imagery belongs to
   `auto`.

4. **Multi-image parity.**  v3's image arrays port: up to **4
   images per node** (a fixed FS loop — cap recorded, the round-13
   list discipline), composited in v3's layer order (the exact
   order is pinned against v3 in the live parity scene during
   implementation), each with its own per-image props.  Per-node
   image lists are **blob-pool records** (the curve-blob/polygon
   pattern: packed per-image entries — registry ref + fit/position/
   size/offset/repeat/flags/opacity/tint — with round-11
   compaction), one packed offset|count ref column on nodes.

5. **Prop surface** (14 of v3's 16, plus the two new props):
   `background-image` (URL / data-URI; list-capable),
   `background-fit` (`none | contain | cover`),
   `background-image-opacity`, `background-position-x/-y`,
   `background-offset-x/-y`, `background-width/-height`
   (`auto` | %/px), `background-repeat` (`no-repeat | repeat-x |
   repeat-y | repeat`), `background-clip`,
   `background-image-containment` (`inside | over`),
   `background-image-smoothing` (`yes | no`),
   `background-image-crossorigin` (`anonymous | use-credentials |
   null`), plus `background-image-type` and
   `background-image-color` (keyword sets and %-defaults are v3's,
   verified against v3 source at implementation).
   `background-width/height-relative-to` is **not ported** (one name
   per concept: leaves have no padding in v4, and a compound
   parent's stored size is already the padded box — matching v3's
   `include-padding` default; the `inner` variant is the unported
   spelling, recorded).
   **Mapper rules** (the 12b list discipline): list forms are
   constants-only; the single-image forms of `background-image`,
   `background-image-opacity` and `background-image-color` take
   mappers (`data(key)` URLs resolve through the ordinal-dictionary
   path — the icon-per-type pattern; `case` works as everywhere).
   All image props are draw-only **paint** evaluated on the CPU into
   the blob records — a mapped image channel does not join the GPU
   eval kernel (recorded scope note).

6. **Async loading policy.**  Images decode off the hot path
   (`fetch` + `createImageBitmap`, crossorigin per prop); a node
   whose image hasn't landed draws its other layers and
   self-corrects when the upload lands (dirty the touched slots —
   the late-font precedent).  A failed load warns once per URL and
   renders imageless (recorded; no per-element error state).
   Headless instances parse/validate and store records with no
   raster (Node-testable); ghosts do not carry images (the A1
   simplified-body rule, recorded).

7. **Geometry non-interaction + LOD.**  Images never grow
   `boundingBox()` (unclipped overflow is not in bb — consistent
   with the `bounds-expansion` drop) and never affect picking (the
   pick body stays the shape).  The FS skips image sampling below
   the `imageMinPx` on-screen node size (default ~8 px; below ~3 px
   the plain-disc LOD already owns the pixel) — recorded.

8. **Bindings budget.**  Image sampling is FS-only: three rgba tier
   arrays + one r8 icon array + samplers ride the sampled-texture
   binding budget (16 per stage at base limits — separate from the
   8-storage-buffer budget), and the image blob pool is one more FS
   storage buffer, rebalanced per the C3 split precedent if a
   layout overflows.

**Pass split** (tests-first per item; docs in-commit):

- [x] **15.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`): this plan section + the README pointer preceded all
  round-15 implementation.
- [x] **15.1 ImageRegistry + loader** (2026-08-01) —
  `src/gpu/image-registry.mts`: entries dedup by (kind, crossorigin,
  url) with refcounts; freed ids recycle through a free-list and
  report to the renderer via `takeFreed()` (the layer reclaim
  channel); rgba tier assignment from the decoded longest side
  (128/512/1024, cap tier clamps); sdf-icon entries raster at the
  fixed `SDF_IMAGE_SIZE` and carry no rgba tier; decode runs behind
  an injectable async rasterizer (`setDecoder` kicks entries
  acquired headless — the mount path), failures warn once per url
  and stay failed (re-acquire never re-kicks), and a decode
  resolving after its entry was freed is dropped by object identity
  so recycled ids can never take stale rasters.  `promote(id,
  demandPx)` re-rasters *vector* entries at the smallest covering
  tier (the 15.6 meter's primitive; raster sources and covered
  demands no-op).  Tests-first: 10 specs in
  `test/gpu-image-registry.mjs` red then green — 2059 Node tests,
  typecheck + lint clean.
- [x] **15.2 Props + model** (2026-08-01) — contract first:
  `node.imageRef` (offset | count << 24 into the new image-record
  pool — a third `CurveBlob` with round-11 compaction, relocations
  rewriting the ref column) + `delta.imageBlob` +
  `ModelView.imageBlob()/images`.  `GraphStore.setNodeImages` packs
  IMG_STRIDE(12)-float records (entry id, mode flags, opacity,
  pos/offset/size values + unit bits, sdf tint at 2 bytes/float) and
  acquires new registry entries *before* releasing old ones, so
  shared urls never transit refcount 0 on restyle; the imageless
  fast path is one ref-column read; `removeNode` releases through
  the same call.  Style: all 16 props parse/validate/read back
  (v3's keyword sets and defaults; per-image lists distribute
  last-value-repeats; `relative-to` throws as unported; image props
  are node-only), stored-truth readback reads the blob records
  (lists space-joined, the 12b convention).  Mappers: the
  **string-interning enum channel** — `background-image` compiles
  as an enum mapper whose parseEnum interns urls per compile (case
  `then`s, ordinal ranges and raw passthrough data values alike),
  covering both icon-per-type and photo-per-node; `-image-opacity`
  and `-image-color` are plain number/color channels; every other
  image prop rejects mappers (the 12b list rule).  Tests-first: 17
  specs in `test/gpu-background-image.mjs` red then green — 2076
  Node tests, typecheck + lint clean.
- [x] **15.3 RGBA draw path** (2026-08-01) — the tiered-array draw,
  in its own pass + pipeline: the node FS sits at exactly 8 storage
  buffers, so imaged nodes draw **one extra instanced quad** off the
  same culled visible lists (leaf stream right after the node
  bodies, parent stream right after the parent bodies — v3's
  layering), imageless instances collapsing in the VS and the whole
  pass skipped at `store.imageCount() === 0`.
  `render/image-arrays.mts`: per-tier `texture_2d_array`s with full
  mip chains (blit-generated — WebGPU has no generateMipmaps),
  layers as slots (`TierAllocator`: free-list, doubling growth with
  live-mip copy-over, 256-layer base-limit cap warn-once), and the
  entry-indexed **image table** storage buffer
  (status/tier/layer + natural + raster dims) that gates sampling
  and scales UVs into partially-filled layers.  The FS walks the
  blob records in list order compositing later-over-earlier,
  samples with **textureSampleGrad** (explicit gradients hoisted to
  uniform flow, so the per-record branching is legal), emulates
  smoothing: no by texel-center snapping, masks `clip: node` by the
  node SDF — containment `inside` clips at the border's inner edge
  (border stays visible; a translucent border shows fill, not
  image — recorded beside the B1 band rule), `over` at the shape
  boundary — and confines repeat tiles to the node box (recorded).
  `clip: none` rects grow the quad in the VS.  The mirror gained
  the image blob's realloc/span twin; the browser decoder
  (`render/image-decoder.mts`: fetch + createImageBitmap, SVG via
  img + canvas at target size, decode-time downscale into the cap
  tier, crossorigin modes with `null` narrowed to same-origin —
  recorded) attaches at init and detaches on destroy.  WGSL lesson
  re-hit and re-recorded: `ref` is reserved (the console-error
  guard caught it).  Verifies: 6 Node specs
  (`test/gpu-image-arrays.mjs`, tests-first), the `images-basic` and
  `images-cover-clip` goldens, and **`parity-images` vs v3 at
  0.000%** — fit/position/opacity math is pixel-exact.  2082 Node
  tests, 122/122 Playwright, typecheck + lint clean.
- [x] **15.4 Multi-image compositing** (2026-08-01) — the 15.3 FS
  loop verified across full multi-image records: a Node spec pins
  per-image independence of every list prop at its index (fit /
  repeat / clip / containment / smoothing / type, four distinct
  registry entries), the `images-multi` golden pins four
  overlapping images with per-image sizes/positions/opacities and
  a half-translucent source (blend math), and
  **`parity-images-multi` vs v3 at 0.000%** pins the layer order —
  v3's canvas draws ascending index with source-over, so **later
  list entries composite on top** (not the CSS first-on-top
  convention; verified against v3's drawImages loop and now
  pixel-pinned).  The cap-overflow warn landed in 15.2.  2083 Node
  tests, 124/124 Playwright, typecheck + lint clean.
- [x] **15.5 SDF icon mode** (2026-08-01) — the glyph trick,
  generalized: sdf-icon sources raster once through the decoder's
  alpha-grid path (SVG via img + canvas, rasters via bitmap +
  canvas — a multi-color source collapses to its alpha silhouette;
  recorded), the **glyph atlas's exact `computeSdf` EDT** runs at
  upload, and the field lands in a dedicated r8
  `texture_2d_array` (fixed 128², layers slot-allocated as tier
  index 3 in the shared TierAllocator, no mips — the field
  re-thresholds at any scale).  The FS icon branch samples with
  the same explicit gradients and applies an **analytic AA width**
  (fwidth is illegal in the non-uniform record loop: coverage per
  screen px = sampled texels-per-px / SDF_RADIUS), tinting by the
  record's `background-image-color` — so icon color is
  mapper-drivable while the raster is shared.  Pins: the
  `images-sdf-icons` golden (tint mapper, red + teal hearts from
  one SVG entry) and a programmatic crispness spec — at zoom 6 the
  sdf edge transition stays ≤ 2 px while the rgba path's 128px
  raster ramps ≥ 3 px (the same node restyled between exports,
  since `background-image-type` is constants-only — recorded).
  2083 Node tests, 126/126 Playwright, typecheck + lint clean.
- [x] **15.6 SVG zoom-promotion + export re-raster** (2026-08-01) —
  the demand meter: per unique *vector* entry, the max on-screen
  device-px demand among its shown, in-viewport user nodes (one
  scan over the imageRef column), debounced 250 ms behind viewport
  events and re-checked when fresh uploads land (a graph built
  zoomed-in promotes on arrival); demand > raster × 1.5 (the
  hysteresis — wheel jitter never thrashes) calls
  `registry.promote`, which snaps to the covering tier and clamps
  at the cap.  No demotion — the round-11 waste policy is the
  eventual reclaimer (recorded simplification).  **Exports
  re-raster**: `exportImage` promotes at the export view's
  zoomDpr (no viewport test) and awaits `registry.whenSettled()`
  (bounded 2 s; in-flight tracking landed in the registry with its
  own Node specs), syncing the fresh rasters before the export
  frame encodes.  Fix fallout caught by the suite: the 15.5
  crispness spec's rgba contrast switched to a *raster* square —
  the meter (correctly) sharpened its auto SVG.  Pins: zoom 6 →
  rasterPx ≥ 512 + edge ramp ≤ 3 px after settle; `png({ scale: 6 })`
  promotes and exports crisp while the screen never demanded it;
  the WYSIWYG self-diff gained an imaged phase (scale-1 exports
  still pixel-match the screen).  2084 Node tests, 128/128
  Playwright, typecheck + lint clean.
- [x] **15.7 LOD + benchmark + true-up** (2026-08-01) —
  **`imageMinPx`** (renderer option, default 8): the image VS
  collapses the quad when the node shows below the floor in
  displayed px (the labelMinPx semantics; export uniforms use the
  export scale — a figure's own resolution), so far-zoom scenes pay
  zero image sampling; pinned by a Playwright spec (no image ink at
  20 px under a 30 px floor, ink appears at zoom 2).  The renderer
  benchmark gained **`gen-25k-images`** (25k × 50k, four icon types
  via `data.itype`, styled through the ordinal url mapper on the
  gpu side and type selectors on v3; icon data-uris built at page
  runtime) — the scene is wired like its siblings; numbers were not
  recorded on this box (software adapter — a different machine
  class, per the benchmark's own warning).  *Correction
  (2026-08-03)*: that parenthesis is wrong for the same reason 18.5's
  was — this box has an AMD RX 580 and the benchmark reaches it (see
  the hardware validation pass below); the images scene simply has not
  been measured.  The ordinal-url mapper
  form is Node-pinned.  Final docs true-up in this commit.
  **Round 15 is complete.**  2085 Node tests, 129/129 Playwright,
  typecheck + lint clean.

**Risks tracked**: upload bursts on initial load (decode is already
async; uploads coalesce per frame); WGSL non-uniform texture access
(explicit-gradient sampling or sample-both-select — chosen at
implementation, pinned by goldens); crossorigin/tainting differences
between decode paths; registry leaks under style churn (refcount
specs); multi-image FS cost (the benchmark item guards it).

## Round 16 plan — multiline labels + label bounding boxes (planned 2026-08-01)

The multiline/label-bb round the parity triage kept deferring to —
`text-wrap` and friends, plus the labels-in-bb call.  All calls
signed off 2026-08-01.

**Signed-off design calls:**

1. **Labels join `boundingBox()` and `fit()` by default** (v3
   parity — the most user-visible payoff: fit stops cropping
   labels).  `boundingBox(options?)` gains an options object —
   `{ includeLabels: true }` default, unknown keys throw — honored
   by element/collection bb, `renderedBoundingBox`, the store's
   whole-graph scan (no-arg `fit`/`center`), `getFitViewport`,
   animated `fit:`/`center:` targets and `boundingBoxAt`.  Because
   label shaping is **write-eager and memoized** (it runs on
   text/font/wrap writes, never per frame — the model-space
   decision), node-label laid dims sit in the sidecar before any bb
   read: the store scan's node-label term is the anchored laid box
   (cheap and exact).  Edge labels keep the dual tier: the scan
   uses a conservative anchor bound (chord midpoint / end-offset
   position ± block + margins + curve slack), public `.bb()` the
   exact anchor via the route evaluator.  Goldens whose fits change
   regenerate once, in the landing item (recorded).

2. **The wrap family** (v3 semantics; node labels, edge labels and
   the D4 end-label streams alike): `text-wrap` (`none | wrap |
   ellipsis`, default `none`), `text-max-width` (model px),
   `line-height` (multiplier, default 1), `text-overflow-wrap`
   (`whitespace | anywhere`), `text-justification` (`auto | left |
   center | right`, `auto` side-aware per v3).  `wrap` honors
   embedded `\n` and breaks at `text-max-width`; `ellipsis`
   truncates with `…`; `none` keeps today's single line.  All
   mapper-capable (CPU-evaluated, the label sidecar tier).

3. **Shaping stays CPU — memoized, write-driven.**  One pure module
   (extending `label-layout.mts`): breaker + justification + block
   metrics, keyed by (text, face, font-size, wrap, max-width,
   overflow-wrap, line-height); glyph runs rebuild only on
   shaping-input writes.  The earlier design sketch of a *GPU
   metrics pass* is **retired as unnecessary** (recorded): shaping
   costs ~µs/label and runs on writes only; the offload slot stays
   logged if a profile ever disagrees.

4. **Renderer**: multi-line glyph emission into the existing
   GlyphBuffer ranges (per-line x offsets by justification, y by
   line-height), the text background/border box takes the block
   extent, the `text-valign`/`halign` grid anchors the block,
   autorotate rotates the block as a unit, and the
   fade/`min-zoomed-font-size` cull predicates are unchanged (the
   block AABB grows the cull bound).

5. **The parked props' v4 forms** (from the 2026-07-29 triage):
   `box-select-labels` becomes the core option
   `boxSelectionIncludesLabels` (default false, v3's default) — one
   more term in `refsInBox` off the same laid dims;
   `text-metrics`'s v4 form is the public exact measure
   `eles.labelBoundingBox()` (laid block at the anchor, memoized) —
   an API, not a style prop.

**Pass split** (tests-first per item; docs in-commit):

- [x] **16.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-16 implementation.
- [x] **16.1 Shaping engine** (2026-08-01) —
  `render/label-wrap.mts`: `breakLines` (v3's `text-wrap` semantics —
  `none` collapses newlines, `wrap` honors `\n` + greedy word wrap
  with `whitespace` overflow vs `anywhere` mid-word splits,
  `ellipsis` truncates one line with '…'), `layoutLabelBlock`
  (lines stacked by lineHeight × em, justified inside the block,
  block centered about x = 0), and **`estimateBlock`** — the same
  breaking logic over flat per-char advances, which is what keeps
  the 16.4 label bb meaningful *headless*: the store estimates dims
  with no renderer, and rendered instances upgrade them to exact
  laid dims (a recorded approximation).  Advances are injected, so
  one breaker serves both consumers by construction.  11 Node specs
  in `test/gpu-label-wrap.mjs`.  2096 Node tests, typecheck + lint
  clean.  (The memo lands with the LabelLayer integration in 16.3,
  where the atlas-keyed cache lives.)
- [x] **16.2 Props + sidecar** (2026-08-01) — the five wrap props
  parse/read back/map with v3's keyword sets and defaults
  (`text-wrap` none | wrap | ellipsis, `text-max-width` 9999,
  `line-height` 1, `text-overflow-wrap` whitespace | anywhere,
  `text-justification` auto | left | center | right); all five are
  mapper-capable (the sidecar tier), both label groups.  The
  sidecar entry stores the **resolved** justification (auto folds
  against `text-halign` at write — v3's hanging-label rule; edges
  center) while `style('text-justification')` reads back the
  declared value incl. 'auto', as v3.  **Label dims live in the
  store** (`labelDimsAt`/`setLabelDims`, per stream): `setLabel`
  estimates immediately via `estimateBlock` — the headless bb
  input — and the renderer's glyph build upgrades to exact laid
  dims (never marking label-dirty — no rebuild loop); dims changes
  bump the geometry epoch, since labels join bounding boxes in
  16.4.  `label-wrap.mts` moved to the gpu root (a dual-consumer
  module, the curve-geometry precedent).  One historical pin
  updated: gpu-style's unsupported-prop example was `text-wrap`,
  which now exists — it pins `background-blacken` (dropped by
  decided design) instead.  Tests-first: 10 specs in
  `test/gpu-text-wrap-props.mjs` red then green — 2106 Node tests,
  typecheck + lint clean.
- [x] **16.3 Renderer** (2026-08-01) — LabelLayer lays every stream
  through `layoutLabelBlock` behind the **shaping memo** (keyed on
  text + scale-free wrap params, cleared with the atlas face — hit
  counters exposed for the 16.5 benchmark), feeds **exact laid
  dims** back to the store per build (the 16.4 bb term's upgrade
  path), and switched the alignment shifts + text-background box
  from ink extents to **block metrics** (advance width ×
  line-stacked height — ink undershot multi-line blocks); the
  change stayed within the label goldens' tolerance, so no golden
  churn.  Autorotate needed nothing: glyphs rotate about the anchor
  individually, so a multi-line block rotates as a unit by
  construction.  Pins: the `labels-wrap` golden (three-line wrap
  under left/center/right justification via mappers, ellipsis
  truncation, unwrapped control) and `labels-wrap-edge` (a two-line
  autorotated edge label with its block-sized box).  2106 Node
  tests, 131/131 Playwright, typecheck + lint clean.
- [x] **16.4 Label bb** (2026-08-01) — labels join
  `boundingBox()`/`fit()` **by default**: the options object
  (`{ includeLabels }`, unknown keys throw) rides collection bb,
  `renderedBoundingBox` and the store's whole-graph scan (no-arg
  fit/center/getFitViewport read it implicitly), and
  `boundingBoxAt` carries the node-relative label box to
  hypothetical positions (animated-layout fit targets cover labels).
  Terms: **node labels are exact** — `store.nodeLabelBox` places
  the laid (or headless-estimated) dims at the D3 anchor with
  halign/valign shifts, margins and the text-background padding
  (pad counts only when a box draws); **edge labels are
  conservative** — `edgeLabelSlack` is a block-covering radius
  (rotation-safe: width/2 + |margins| + vertical extent + pad +
  endOffset) grown about both endpoints, sound wherever the anchor
  lands on the drawn path (a recorded approximation; the exact
  per-anchor edge tier was not needed — fit may slightly over-fit,
  never under).  `eles.labelBoundingBox()` is the public exact
  measure (the v4 form of v3's text-metrics surface): node labels
  at anchors, mid-labels at the drawn (curve-aware) midpoint, end
  labels via the endpoint radius.  Headless dims are estimates
  (recorded — 16.1's estimator); rendered instances re-fit exact.
  No golden churn (goldens pin explicit viewports) and zero
  regressions across the 2116-test suite; the fit semantics are
  pinned headless in `test/gpu-label-bb.mjs` (10 specs, red first —
  incl. getFitViewport reading the label-inclusive box), which
  covers what the planned browser fit spec would have.  131/131
  Playwright, typecheck + lint clean.
- [x] **16.5 Box-select labels + benchmark + true-up** (2026-08-01)
  — **`boxSelectionIncludesLabels`** (ctor option +
  getter/setter, default false — v3's box-select-labels default):
  `refsInBox` additionally requires the node's label box inside the
  band; Node-pinned (label poking out excludes the node only when
  opted in; runtime toggle).  **Shaping cost swept**
  (`benchmark/gpu/labels.mjs`, pure Node at 100k wrapped labels):
  breakLines ~3.8 µs, estimateBlock ~4.6 µs, the full
  setLabel-with-estimate write ~5.1 µs/label (write-driven, never
  per frame), and the whole-graph bb scan pays ~0.1 µs/label for
  its label terms.  **Memo hit-rate pinned** in a `webgpu` spec:
  120 same-text wrapped labels shape ≤ 3 times
  (`stats().labelShapeHits/Misses`).  Final docs true-up (README
  round-16 section).  **Round 16 is complete.**  2117 Node tests,
  132/132 Playwright, typecheck + lint clean.

**Risks tracked**: golden churn confined to 16.4's one commit;
whole-graph scan cost with the label term (two extra reads per
labelled slot — benchmarked); long-text glyph counts (no new cap —
glyph instances already scale; ellipsis is the bounding tool);
edge-label conservative bounds vs autorotated blocks (reuse the D4
chord-slack machinery).

## Round 17 plan — event vocabulary + the extension contract (planned 2026-08-01)

Two permanent-API calls made in one sitting: the v4 event names, and
how extensions plug in.  Both are cheap to build once decided; both
gate ecosystem work.

**Signed-off design calls:**

1. **The curated vocabulary, plus the official pointer family.**
   Adopted with v3 semantics (each firing rule pinned against v3
   source in a red spec before implementation):
   - *Drag-state* (elements): `grab`, `grabon`, `drag`, `free`,
     `freeon`, `dragfree`, `dragfreeon` — the `-on` variants fire
     only on the directly grabbed element; the plain forms fire on
     every node the gesture moves (drag companions included);
     `dragfree`/`dragfreeon` only when the node actually moved.
   - *Device-normalized*: `tapstart`, `tapdrag`, `tapdragover`,
     `tapdragout`, `tapend` (element + core), `tapselect`/
     `tapunselect`, `cxtdragover`/`cxtdragout`.
   - *Viewport gestures* (core): `dragpan`, `scrollzoom`,
     `pinchzoom`.
   - *Pointer re-emits* (element + core): `pointerdown`,
     `pointermove`, `pointerup`, `pointercancel`, `pointerover`,
     `pointerout` — the official DOM vocabulary v4's interaction
     layer already consumes, re-emitted with graph positions and
     `originalEvent`.
   **Dropped, recorded**: the `vmouse*` aliases (the `tap*` names
   *are* the normalized vocabulary) and the raw mouse/touch re-emits
   (`mousedown`/`mousemove`/`mouseup`/`click`, `touchstart`/...) —
   `pointer*` is their one modern spelling; the existing
   `mouseover`/`mouseout` emissions stay.  `event.preventDefault()`
   stays unported (gesture defaults are gated by options/flags, not
   handlers; `originalEvent` keeps the DOM method) — recorded.  All
   new element events bubble through the round-14.5 phase machinery.

2. **Extensions are direct objects — no registry.**  No
   `cytoscape.use`, no string registration, no global state: an
   extension is an import the app passes in (tree-shakeable, typed).
   Pass 1 designs the **layout contract** only; core/collection/
   renderer extension points stay out (recorded: mappers +
   predicates cover the common cases; revisit on demand).
   - **Shape**: a layout impl implements
     `{ run(ctx): void | Promise<void>, stop?(): void }`.
     `cy.layout({ impl: Fcose, ...options })` (and
     `eles.layout({ impl, ... })`) construct and run it through the
     existing lifecycle — `layoutstart`/`layoutready`/`layoutstop`
     on the core, `promiseOn`, `stop()`, the animate/fit plumbing;
     `{ name }` keeps addressing builtins.
   - **LayoutContext (`ctx`) is columnar-first**: slot-indexed reads
     (a positions view, node iteration pre-filtered to unlocked
     leaves per the round-14 rule, CSR adjacency, per-slot degree,
     the scoped element list for subset layouts, bb/viewport
     helpers, resolved options) and one bulk write —
     `setPositions(slots, xy)` on the round-5 slot path (one dirty
     span, listener-gated events) — plus the `layoutPositions`
     finisher (spacingFactor/transform/animate/fit, v3 plumbing).
     Handles stay reachable (`ctx.eles`) at handle cost; the
     contract makes the columnar path the obvious one.
   - Layout instances stay non-emitters (v4 layout events fire on
     the core — the round-10 rule, recorded).

**Pass split** (tests-first per item; docs in-commit):

- [x] **17.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-17 implementation.
- [x] **17.1 Pointer re-emits + tap family** (2026-08-01) — the
  official vocabulary lands: `pointerdown` (all buttons, the cxt
  branch included), `pointermove` (every move),
  `pointerup`/`pointercancel`, and `pointerover`/`pointerout`
  riding the hover transitions beside mouseover/mouseout; plus the
  device-normalized `tapstart` (primary press), `tapdrag` (moves
  while a press is active — the raw pointermove covers unpressed
  motion) and `tapend` (release of a press, ahead of the
  tap/selection flow — v3's up → tapend → tap ordering).  Targets
  follow the press (the grabbed/cxt element) else the hovered
  element, background to the core; touch arrives through the same
  pointer handlers by construction.  Pinned by a `webgpu`
  mouse-driver spec (hover-over/out, press-drag-release on the node
  and on the background).  2117 Node tests, 133/133 Playwright,
  typecheck + lint clean.
- [x] **17.2 Drag-state family** (2026-08-01) — `grab`/`grabon`,
  `drag`, `free`/`freeon`, `dragfree`/`dragfreeon` with v3's firing
  rules: the `-on` variants fire only on the *directly* grabbed
  element; the plain forms fire on it **and every selected
  companion** in the drag set; `drag` fires per movement on all of
  them; the dragfree pair fires only when the gesture actually
  moved; a cancelled gesture frees without dragfree.  Pinned red
  first in a `webgpu` mouse-driver spec: exact per-name counts on a
  two-selected-node drag (companion never gets `-on`), grab → drag
  → free ordering, and a moveless press grabbing/freeing without
  drag events.  2117 Node tests, 134/134 Playwright, typecheck +
  lint clean.
- [x] **17.3 Selection + hover-during-drag** (2026-08-01) —
  `tapselect`/`tapunselect` fire on the tapped element beside its
  gesture-driven select/toggle-off (background clears and box
  selection keep their own events, as v3); `tapdragover`/
  `tapdragout` and `cxtdragover`/`cxtdragout` ride a throttled
  synchronous node pick while a press is active — **nodes only**
  (the exact CPU pick; edges would need the async GPU tile —
  recorded), state cleared silently when the gesture ends.  Spec
  lesson kept in-file: a *panning* background drag moves the
  content with the cursor, so nothing is ever crossed — the pin
  drags across the node under the box gesture (panning disabled)
  and under a cxt drag.  2117 Node tests, 135/135 Playwright,
  typecheck + lint clean.
- [x] **17.4 Viewport gesture events** (2026-08-01) — `dragpan`
  (each applied background pan step), `scrollzoom` (each wheel zoom
  — trackpad pinches arrive as ctrl+wheel and take this path, the
  round-10 rule) and `pinchzoom` (each two-finger zoom step), all
  core-level with the gesture's model position.  Pinned in a
  `webgpu` spec (wheel, background drag-pan, and a synthetic
  two-finger pinch — each firing its own name and not the others').
  2117 Node tests, 136/136 Playwright, typecheck + lint clean.
- [x] **17.5 The layout contract** (2026-08-01) —
  `layout/contract.mts`: `cy.layout({ impl, ...opts })` (and
  `eles.layout`) runs a user class (constructed argless) or object
  implementing `{ run(ctx), stop?() }` — **no registry, no
  cytoscape.use, no global state**.  `run` may return a promise
  (the GPU-layout shape); the wrapper exposes `promise()` and
  drives the core lifecycle exactly once per run whether the impl
  uses the discrete finisher (`ctx.layoutPositions(fn)` — the full
  v3 plumbing, its layoutstart folded into the wrapper's via an
  internal flag) or the direct bulk path (`ctx.setPositions` on
  the round-5 slot path).  The **LayoutContext is columnar-first**:
  `nodeSlots()` (scope order, pre-filtered to unlocked leaves —
  the 14.11 rule), live `positions()`/`endpoints()` views,
  O(1) `degreeOf` off CSR, `edgeSlots()`, scope bb + viewport
  dims, `ctx.options` carrying custom knobs, with handles reachable
  at `ctx.eles`/`ctx.nodes`.  Layout instances stay non-emitters
  (round-10 rule; events fire on the core with the wrapper as
  `event.layout`).  Tests-first: 10 specs in
  `test/gpu-layout-contract.mjs` red then green — object + class
  impls, single-lifecycle finisher, async run, scoping, the
  leaf/unlocked filter, columnar reads, stop(), malformed rejects,
  and the random builtin re-expressed through the public contract
  (the conformance shape external authors can crib).  Two
  error-message pins updated for the new layout dispatch text.
  2127 Node tests, typecheck + lint clean.
- [x] **17.6 Example + true-up** (2026-08-01) — `debug/webgpu`
  gained the worked example: `SpiralLayout`, a plain class run via
  `cy.layout({ impl: SpiralLayout })` with `?layout=spiral`
  (smoke-verified live in scripted Chromium: spiral positions, no
  page errors).  README gained the round-17 section (the curated
  vocabulary with its recorded drops + the direct-object contract).
  **Round 17 is complete.**  2127 Node tests, 136/136 Playwright,
  typecheck + lint clean.

**Risks tracked**: name-semantics divergence from v3 (red specs
against v3-source readings per event, before implementation); emit
volume on drag hot paths (all listener-gated; the 17.2 specs assert
the no-listener fast path stays allocation-free); contract surface
creep (pass 1 exposes only what random-via-contract and an
fcose-shaped consumer demand).

## Round 18 plan — GPU force layout (planned 2026-08-01)

The last queue pillar: the round-9 "GPU layouts: logged for later"
design, built.  Signed off 2026-08-01.

**Signed-off design calls:**

1. **A new GPU-native layout, `force`** — not a cose port (v3's
   cose stays in v3: its option surface and per-iteration structure
   are CPU-shaped, and ports arrive later via the round-17
   contract).  The model: spring attraction along edges toward
   `edgeLength`, short-range repulsion via a **uniform-grid cutoff**
   (grid rebuilt per iteration by counting sort — the
   stream-compaction discipline — repulsion gathered over the 3×3
   cell neighborhood), a weak centering gravity that keeps
   disconnected components in frame, velocity integration with
   alpha cooling, and seeded deterministic initial scatter (id-hash,
   the haystack precedent).  Force accumulation is **gather-only —
   no atomics** — so a run is deterministic on a given executor
   (fixed reduction order).
2. **Ownership: GPU-authoritative with readback on settle** — the
   round-9 logged design.  During a run the position column is
   GPU-owned under the existing lease machinery (mirror skips
   uploads; CPU reads stale per the motion-staleness rule); the sim
   integrates in its own pre-cull pass so cull/edges/labels read
   live positions and the graph **renders live every frame** — the
   watchable-layout-at-100k showpiece.  On convergence (max
   displacement < ε for K consecutive iterations) or `stop()`, one
   readback settles the CPU columns — the sole readback exception
   in the architecture, per the round-9 call — then derived
   geometry flushes and `layoutstop` fires.
3. **The CPU reference is the spec.**  A complete CPU implementation
   (same options, same grid/cutoff math) runs headless instances
   and is what the Node specs pin (seeded runs to fixed coordinates
   on small graphs, energy decay under cooling, convergence,
   locked-node pinning).  CPU and GPU trajectories are **not
   bit-agreed** (recorded — parallel FP reduction order differs):
   GPU correctness pins invariants instead — no NaN/exploded
   positions, displacement decay, seeded summary statistics (edge
   length distribution, bb extents) within tolerance of the CPU
   run.
4. **Demotions and scoping** (the 14.11 pattern): compound graphs
   run the CPU executor (a GPU lease would leave the auto-bounds
   derivation reading stale positions; leaves simulate, parents
   derive per flush).  Locked nodes pin (skip integration).
   Subset layouts (`eles.layout`) simulate the subset only;
   non-members are inert (recorded).  Flat graphs at scale — the
   perf case — take the GPU path.
5. **Options surface** (minimal, consumed identically by both
   executors): `edgeLength` (number, or a plain function evaluated
   once into a per-edge column at start — the algorithms-round
   rule), `repulsion`, `gravity`, `decay`, `iterations` (cap),
   `threshold` (ε), `seed`, `randomize` (fresh seeded scatter vs
   current positions), `animate` (`true` live | `false`
   settle-then-draw), `fit`/`padding`.

**Pass split** (tests-first per item; docs in-commit):

- [x] **18.0 Docs-first** — landed with the design-sitting commit
  (`0f0ee859`), before any round-18 implementation.
- [x] **18.1 CPU reference** (2026-08-01) —
  `layout/force-sim.mts`, pure and slot-indexed: uniform-grid
  cutoff repulsion (counting-sort rebuild per iteration; stable
  ascending order inside cells — the deterministic gather order
  both executors share), springs off CSR-style incident lists,
  centering gravity, and **pure damped gradient integration**
  (`F · alpha` per step, no velocity state — no ringing, one less
  GPU buffer, and displacement tracks force so the threshold
  settle is robust; velocity integration was tried and dropped for
  exactly the ringing-trips-the-settle failure).  Forces gather
  into a scratch and apply in a second pass (the kernel's
  two-dispatch structure).  **Model calls made empirically**, both
  recorded: the repulsion cutoff is the *mean ideal edge length* —
  repulsion vanishes exactly where a spring rests, so a connected
  pair's equilibrium is L itself (cutoff 2L left it at 1.7L); and
  a cutoff model does **not** promise global untangling — a curled
  chain is a legitimate local minimum (sfdp-style multilevel is
  future work).  Coincident points separate along a deterministic
  index-hash direction (no NaNs on degenerate input).  Tests-first:
  8 specs in `test/gpu-force-sim.mjs` — seeded determinism,
  identical-run reproducibility, spring rest length, repulsion
  separation, gravity containment, cooling/convergence, pinning,
  and the path-relaxation invariants.  2135 Node tests, typecheck +
  lint clean.
- [x] **18.2 Layout plumbing** (2026-08-01) — `layout/force.mts`:
  `cy.layout({ name: 'force' })` wraps `ForceLayoutImpl` in the
  **round-17 CustomLayout plumbing — the contract's first
  production consumer** (an external layout would ship identical
  code).  Options: `edgeLength` (number or a plain fn of the edge
  handle, resolved once — the algorithms rule), the sim params
  (repulsion/stiffness/gravity/decay/iterations/threshold),
  `seed`/`randomize` (fresh deterministic scatter vs relaxing
  current positions; pinned nodes keep real coordinates either
  way), `animate` (live streaming per frame through the bulk slot
  path — which, as recorded, emits no per-node position events —
  vs settle-then-draw), `stepsPerFrame`, `fit`/`padding`.  Scoping:
  leaves only (parents derive); **locked nodes pin** — they join
  every force pair but never move; subset scopes simulate the
  subset only (recorded).  `stop()` settles early through the
  wrapper.  Tests-first: 7 specs in `test/gpu-force-layout.mjs` red
  then green — lifecycle + ring relaxation + fit, seeded
  determinism end-to-end, fn edge lengths, locked pinning, compound
  leaves-only, subset scoping, live streaming + stop.  2142 Node
  tests, typecheck + lint clean.
- [x] **18.3 GPU kernels** (2026-08-01) — `render/gpu-force.mts`:
  six dispatches per iteration (clear grid → bin count → serial
  exclusive scan → scatter → force gather → apply), sim-indexed
  with `apply` publishing movable nodes into the slot-indexed
  mirror position buffer — encoded ahead of the cull pass, so
  edges/labels follow live; node.position rides the tween-lease
  ownership (mirror skips its uploads; the frame loop keeps its
  clock while a run is live).  **Binding-budget lesson re-hit on
  compute**: three shared bind groups totalled 16 storage buffers
  (the console guard caught it) — each kernel now carries its own
  group with exactly its buffers, the hot gather packing inputs
  (CSR as one [starts][entries] buffer; edges at stride 3 with
  bitcast lengths; the pin flag on bit 31 of the slot map; the
  alpha window + tick + displacement max sharing one atomic meta
  buffer) to land the force kernel at exactly 8.  WGSL lesson #3:
  `meta` is reserved too.  Alpha annealing pre-computes a
  64-iteration window per frame indexed by a device tick (any k
  iterations per submit, no per-iteration uniform writes);
  convergence rides an atomicMax over monotonic f32 bits with a
  4-byte latest-wins staging poll; `readPositions()` is the one
  settle readback (round 9), after which the layout writes the CPU
  columns through the normal dirty-span path.  **Recorded
  narrowing**: the scatter's atomic in-cell order means GPU
  trajectories aren't bit-stable run-to-run — seeded
  reproducibility is the CPU executor's guarantee.  Pinned on a
  real adapter: a provably-long run holds the lease (CPU
  `position()` stale mid-run while pixels advance), `stop()`
  settles real simulated coordinates, and the ring spreads.  2142
  Node tests, 138/138 Playwright, typecheck + lint clean.
- [x] **18.4 Convergence + readback** (2026-08-01) — the batched
  displacement reduction, latest-wins staging poll, settle readback
  and lease-release-before-CPU-write ordering all landed with 18.3;
  this item adds the **invariant parity suite**: on a seeded
  ring-with-chords graph, the CPU executor (animate: false) and the
  GPU executor (animate: true) run the same options and must agree
  on invariants — zero NaN, every node in frame, mean link length
  within [0.6×, 1.7×] of each other, bb width within [0.4×, 2.5×] —
  while trajectories stay deliberately not bit-agreed (recorded).
  The settled bb also pins flushDerived + layoutstop ordering (the
  box reflects the readback coordinates).  2142 Node tests, 138/138
  Playwright, typecheck + lint clean.
- [x] **18.5 Benchmarks + harness + true-up** (2026-08-01) —
  `debug/webgpu/?layout=force` (+ `&seed=N`) runs the live layout
  in the harness (smoke-verified twice in scripted Chromium: zero
  page errors, identical settled extents run-to-run; an earlier
  error burst traced to racing a mid-write bundle on the static
  server, not the code).  The renderer benchmark gained
  **`-- --layout`**: instead of the pan scenarios, each scene runs
  a live force to convergence on the gpu side (wall time + fps
  from renderer stats) with v3's cose as the classic baseline —
  layout quality differs by design; the numbers compare the
  interactive experience.  Numbers recorded 2026-08-01 on real
  hardware — see "Landed (hardware validation pass)" at the end of
  this file, which also corrects this item's original
  "software adapter on this box" assumption.  README
  gained the round-18 section and the round-9 "GPU layouts:
  logged" design bullet is trued up (since built).  **Round 18 is
  complete.**  2142 Node tests, 138/138 Playwright, typecheck +
  lint clean.

**Risks tracked**: pathological densities collapsing the grid (all
nodes in one cell → O(n²) gather; cell-capacity clamp + jittered
seeds, recorded); convergence-check cost (batched reduction);
readback vs in-flight frames (reuse the pick-ring discipline);
executor parameter drift (all constants resolved once, shared by
both executors); interaction mid-run (grab during a layout follows
the animation rule — grabbing is forbidden while an element's
position is leased).

## Landed (hardware validation pass — AMD RX 580, 2026-08-01)

The first full benchmark run of the prototype on real hardware:
Radeon RX 580 (RADV, `amd gcn-4`) on an i9-9900K under Linux,
headless Chromium with the repo's platform-gated ANGLE-on-Vulkan
flags.  Corrections first:

- **The 18.5 "software adapter on this box" note was wrong** —
  headless Chromium offers the hardware adapter with the same flags
  `playwright.config.js` uses.  The trap that produced the earlier
  conclusion: `requestAdapter()` returns null on `about:blank`, so a
  bare-page probe reads as "no GPU"; the benchmark's own probe runs
  on its served page and gets the real adapter.
- **The `--layout` mode was intractable as landed** (it had only
  ever been smoke-tested): cose's per-iteration cost is superlinear
  — ~4.5 s/iteration at 25k × 50k, ~52 min for a *single* iteration
  at 100k × 300k — so the `numIter: 300` baseline hung the suite
  for hours.  Fixed in `b7ea7068` with nested test-style timeouts
  (in-page 30 s polite stop reporting a measured floor + 60 s
  runner-side hard bail that force-closes the wedged page and
  reports "> 60 s"; `--layout-uncapped` removes both).  Two
  starvation findings recorded in that commit: `setTimeout` runs
  minutes late under cose's synchronous iteration blocks, and even
  a rAF watchdog only runs at paint time (first paint 70 s after
  `run()` at 25k with `refresh: 1`), so the hard bail is the only
  reliable bound.

Numbers (dpr 2, 1280×800, adaptive render scale pinned to 1; wall
times are vsync-bound at 60 Hz, so 16.7 ms is the floor):

- **Pan steady state**: v4 holds the vsync floor on every generated
  scene and view — 25k and 100k flat, curved (bezier pairs),
  compound (1k parents), images, labels on and off — while v3
  canvas runs ~230–4200 ms/frame on the same content (25k fit-all
  633 ms → 16.7 ms; 100k fit-all 3693 ms → 16.7 ms).  ndex-x-large
  (465k edges) is the one scene above the floor: 33.4 ms wall
  (2 vsync frames).
- **Device time** (timestamp-query, the unbounded metric): the
  worst generated-scene pass is 19.6 ms (100k zoomed-in, labels);
  ndex fit-all ~37 ms is the only GPU-bound case — with the
  adaptive render scale deliberately pinned off, which production
  defaults would not do.  Labels add +0.2–1 ms per pass; the
  compound scene's parent stream costs ~nothing (2.0 ms fit-all).
- **Init**: v4 246 ms–1.7 s vs v3 2.6–19.2 s per scene (10–20×).
- **Picks under continuous pan**: p50 17–19 ms; 4–5 of 25 requests
  return null.  ~~Flagged for a look~~ — resolved by the pick-ring
  look below: the nulls were **background answers**, not staging-ring
  drops (the scenario holds at most one pick in flight, so the 3-slot
  ring cannot exhaust — the attribution here was wrong), and the
  drop-on-exhaustion policy itself is gone (a full ring now defers
  the request a frame instead).
- **Live layout (`--layout`)**: v4 `force` converges in 697 ms
  (25k), 1472 ms (100k) and 952 ms (ndex) on the GPU executor;
  the compound scene settles in 15.5 s on the CPU executor (the
  14.11 lease rule).  v3 cose reports "> 60 s — bailed" on every
  scene; measured floors from the pre-fix runs: 67 s at 25k,
  3169 s at 100k.

## Landed (pick-ring look, 2026-08-01)

The hardware pass flagged its pick numbers — 4–5 of 25
hover-while-panning requests returning null, attributed to
staging-ring exhaustion — for a look.  The look found the attribution
**wrong**, and a latent policy wart behind the phrasing it leaned on:

- **The nulls were background answers, not drops.**  The benchmark's
  pick scenario holds at most *one* pick in flight (a new `cy.pick()`
  is only issued once the previous one resolved, with a 120 ms gap),
  and one logical request consumes at most one ring slot — so the
  3-slot staging ring **cannot exhaust under that driver**.  The
  nulls are genuine background answers: at fit-all the five probe
  points (0.3–0.7 along the diagonal) mostly sample empty space
  between hairline edges, and far-zoom decimation additionally makes
  sub-half-alpha edges unpickable (the recorded deviation).  The
  scenario's own comment admitted the ambiguity ("background answer
  or a dropped request — the API can't tell them apart"); the
  hardware-pass note picked the wrong branch.
- **Drop-on-exhaustion is gone; a full ring defers instead.**  The
  old policy resolved requests null when no staging buffer was free —
  and the frame had *already encoded and submitted* the full pick
  cull + draw pass before `encodeCopy` threw the copy away.  Now the
  frame checks `hasFreeSlot()` before encoding anything: a saturated
  ring skips the pick pass entirely and leaves the request pending
  (still coalescing latest-wins), and the frame loop's existing
  `hasPending()` reschedule retries it — a slot frees as soon as the
  oldest readback maps, so the extra latency is bounded by in-flight
  GPU work (~1–2 frames).  A pick now resolves null only for
  background, destroy, or device loss — spurious nulls are
  structurally impossible, which also makes the benchmark's `nulls`
  count unambiguous (background only).
- **Saturation is observable**: `renderer().stats().pickDeferrals`
  counts frames that found the ring full and deferred; the pick
  scenario reports it per run (`N background, M ring-deferred`).
- **Confirmed on the hardware-pass box** (RX 580, same config): the
  pick scenario on the four 25k scenes (flat, curved, compound,
  images) reports 4/4/5/5 background answers and **0 ring-deferred**
  on every scene at p50 16.9–18.1 ms — the same numbers the hardware
  pass recorded, now with the null counts attributed correctly.
- Tests: `test/modules/gpu-picking.mjs` unit-tests the ring against a
  fake device (latest-wins coalescing; exhaustion defers — the
  request survives the full ring unresolved, acquires the next freed
  slot, and resolves with a real answer; destroy resolves null), seen
  red under the drop policy first.  A `webgpu` Playwright spec
  saturates picks across frames over an edge (pan-jiggled so every
  request misses the cache) and asserts none resolve null.

## Round 19 plan — slot-moving compaction (planned 2026-08-01; landed the same day — see the Landed section at the end of this file)

The last open architectural item ("Logged — compaction" above): move
live element slots so `highWater`, column capacity and pass-iteration
widths shrink after big removals (the shrink profile) and sustained
churn (the free-list keeps tables from growing, but peak-sized scans
and dispatches persist).  The slot-stable tier (id blob, CSR,
dictionaries) has self-compacted since round 11; this round moves the
slots themselves.

**The three policy calls, decided with the user (2026-08-01):**

1. **Ref survival: forwarding + lazy repair.**  A per-group
   forwarding table maps a moved element's old (slot, gen) to its new
   slot; refs repair lazily on access, and a store-wide compaction
   epoch invalidates cached packed-int membership sets.  User-held
   collections keep working — the interned-singleton invariant and
   the hold-a-query-result app pattern survive, with the cost paid
   only on first post-compaction access.  (Rejected:
   handles-survive-collections-stale, everything-stale — both make
   compaction an app-visible event, which an *auto* trigger cannot
   afford.)
2. **Trigger: auto threshold + explicit `cy.compact()`.**  Auto on a
   dead-slot-ratio threshold (the round-11 waste-over-half policy
   with a floor, metered per group), gated to safe boundaries — never
   mid-batch, mid-emit, mid-frame-encode, or while a GPU force run or
   GPU-offloaded tween is live (live tweens settle first via the
   round-14.11 `settleGpuAll` precedent, or the check defers to the
   next safe boundary).  `cy.compact()` is also public for
   deterministic timing (throws mid-batch; defers with a warn while a
   force run is live).  The shrink profile is exactly where apps
   won't know to call `compact()` — auto is the user-serving default.
3. **Draw order: stable — a visual no-op.**  Compaction preserves
   the current relative slot order.

**The load-bearing consequence: the remap is monotone.**  Moving live
slots down in ascending order (each live slot drops to the lowest
free position below it) preserves relative order by construction,
which is what makes call 3 free — and it is *also* what keeps derived
curve geometry identical: bundle rank (`bundleOffset` over the
sorted bundle), loop stagger index, and the σ orientation sign all
derive from relative slot order (`curve-index.mts`), so a monotone
remap leaves every derived curve param byte-identical and no pair
re-derivation is needed.  CSR per-node incident order (insertion
order) and the cpu-pick z-rule (topmost = highest slot) are likewise
unchanged.  A non-monotone remap would silently change z-order and
curve geometry; the implementation asserts monotonicity in dev.

**Remap inventory** (surveyed 2026-08-01; classification per
structure): the store tables permute per column (`arrays`, `gen`;
`free` clears; `highWater` shrinks to the live count; capacity
shrinks realloc the columns); `edge.endpoints` is the one column
holding cross-group slots (a node remap rewrites it wholesale); the
id index fuses the permutation into its `compactBlob` walk + full
probe rehash; CSR rebuilds via the round-11 `Adjacency.rebuild`;
hierarchy permutes `parent`/`parentGen`/`depth` and rebuilds
`children`, nulling the parent draw permutation (renderer re-uploads
on identity change); the curve index permutes its per-edge records
and rebuilds `pairs`/`loops` keys (params untouched — monotone); the
three blobs permute their slot-indexed offset tables (pools are
offset-space); the data sidecar permutes `values`/`present`/
`indices` **in place** (bound mapper evaluators close over those
buffers by reference — the dict-remap precedent); label sidecar
entries/dims/dirty rekey per stream; the misc slot-keyed maps
(`opacityBase`, `parentFallback`, `compoundStyle`, `resolvedPad`)
rekey; `geoEpoch` bumps (edge-bb memo); monotone maxima recompute
exactly (a compaction is the natural moment); mapper spans re-emit
whole-column.  Renderer: both groups' `resized` flags are set — the
existing paths do the rest (mirror full realloc + re-upload — a
capacity change already forces it — pick-cache invalidation, cull
`meta` rewrite); the mapper runtime reconfigures (region layout is
capacity-aligned); glyph streams rebuild owner words via
`markAllLabelsDirty` + `process` (the re-raster path); GPU tween
channels re-register their slot buffers after the settle;
`ChannelWrite.slots`/animation-queue packRef keys rebuild.

**Items (tests-first, one isolated commit each):**

- **19.1 — store-core compaction.**  `ColumnTable.compact(perm)` +
  `GraphStore.compact(group?)`: the monotone permutation build, column
  moves with capacity shrink, order-list fusion (`compactOrder`
  already drops tombstones), id-index fusion, `edge.endpoints`
  rewrite on node moves, CSR rebuild, dirty/`resized` signaling, and
  the vacated-tail zeroing (tombstoned flags).  Node specs: state
  identity pre/post (ids, data, positions, flags, adjacency,
  ordering), `highWater === count`, shrink-profile capacity actually
  falls, idempotence (compacting a compact store is a no-op).
- **19.2 — dependent store indexes.**  Hierarchy, curve index +
  blobs, data sidecar in-place permute, label sidecar, misc maps,
  epochs/maxima/spans.  Node specs: compound geometry, curve
  accessors (`controlPoints`/`midpoint`/`boundingBox`) and style
  readback byte-identical pre/post; blob record integrity; mapped
  channels re-evaluate correctly after the permute.
- **19.3 — ref forwarding + lazy repair.**  The forwarding table
  (packed (group, oldSlot, oldGen) → newSlot), gen handling for
  vacated slots so stale refs *fail* plain validation and route to
  repair, `isCurrent`/`_eleFromRef` repair paths that rewrite the
  `Ref` in place (repairing every holder of that object), handle-pool
  permutation with `_refs[0]` rewrite (scratch survives), the
  membership-set epoch, packRef-keyed animation queues, event
  listener re-keying (`'ref:'` qualifiers), forwarding-chain
  composition across consecutive compactions.  Node specs: held
  collections and handles keep answering across a compaction
  (id/data/position/traversals), removed refs stay dead, membership
  caches invalidate, `off()` by handle still matches.
- **19.4 — renderer integration.**  The `resized` handshake, mapper
  reconfigure, glyph rebuild, parent-permutation re-upload, pick
  invalidation, GPU-tween settle + re-register, force-run gating.
  Playwright: pixel self-diff pre/post compaction on a styled scene
  (labels, curves, compounds, images — a visual no-op by assertion),
  pick correctness post-compaction, a mid-animation compaction
  settles and completes correctly.
- **19.5 — triggers, API, meters, benchmarks, docs.**  The auto
  threshold (dead-ratio > 1/2 with floor, per group) at safe
  boundaries, `cy.compact()` (+ the mid-batch throw and live-run
  deferral), `stats()`/store meters for observability, a
  `benchmark/gpu/` shrink/churn sweep (peak-then-small scan widths,
  dispatch counts, memory before/after), and the README section
  (design decision + deviations note) with the "Logged — compaction"
  closure.

**Recorded limits (pass 1):** compaction never runs concurrently with
a live GPU force run (defer, not settle — the sim owns positions);
`cy.compact()` inside a batch throws; a compaction mid-animation
settles GPU-offloaded tweens to the CPU first (CPU tweens remap and
continue); forwarding tables persist until the next compaction and
compose, so repair is total for any ref the app ever re-touches.

## Landed (round 19 — slot-moving compaction, 2026-08-01)

All five items of the round-19 plan above landed the same day, each
tests-first in its own commit; the three design calls held as decided
and one plan deviation is recorded below.

- **19.1 — store core.**  `ColumnTable.compact(remap, newCount)` +
  `GraphStore.compact()`: the monotone remap builds from FLAG_ALIVE
  (live slots move down in ascending order — relative order preserved
  by construction), columns and the gen array rebuild into
  right-sized (×2-step) buffers, `highWater` and capacity drop to the
  live count, the free-list clears.  Generation rule: identity slots
  keep their gens (refs to the stable prefix stay valid with zero
  repair); every changed position takes `oldGenAt(pos) + 1`, strictly
  greater than any gen ever handed out there, so all stale refs fail
  plain validation and route to forwarding.  `edge.endpoints` (the
  one cross-group slot column) rewrites on node moves; the id index
  fuses the permutation into its meta walk + a full probe rehash; CSR
  rebuilds via the round-11 path; the order list fuses against the
  pre-move gen snapshot; `resized` marks hand the renderer its
  existing realloc + full re-upload.
- **19.2 — dependent indexes.**  Hierarchy (links slot-indexed *and*
  slot-valued; parentGen re-stamps against post-move gens; child link
  order kept; draw permutation regenerates), curve index (styled
  records permute; node-keyed pair/loop maps rebuild from the
  rewritten endpoints; derived params **byte-identical** with no
  re-derivation — monotone keeps bundle rank/stagger/σ), the three
  blob offset tables, the data sidecar **in place** (bound mapper
  evaluators hold the buffers by reference), label
  entries/dims/dirty, opacityBase/parentFallback, whole-column mapper
  span re-emits, and `markAllLabelsDirty` as the glyph-rebuild feed.
  *Plan deviation, recorded*: the conservative monotone maxima are
  **not** recomputed at compaction — they stay monotone (sound; slack
  can only be loose), and exact recomputation would need per-kind
  record decoding for little benefit.
- **19.3 — ref forwarding + lazy repair.**  Per-group forwarding
  chains (packed (slot, gen) → (newSlot, newGen)) that persist and
  compose; `isCurrent()` repairs a forwarded ref **in place** before
  answering (one gen compare on the fast path; removed elements stay
  dead).  `GpuCollection._refs` became an epoch-guarded accessor —
  one chokepoint syncs all ~115 consumers and drops the packed
  membership cache (materializer sweep unchanged).  `cy._compact()`
  permutes the interned handle pool (handle identity + scratch
  survive), repairs and re-keys element-bound listener qualifiers
  (off() through fresh handles matches), and re-keys animation queues
  with slot lists re-pointed.
- **19.4 — renderer.**  Two real gaps closed: glyph streams **clear
  wholesale** on the compaction epoch (owner slots are baked into
  instances; incremental rebuild could alias a stale run onto a
  different element's new slot), and mid-flight GPU tweens **demote**
  to the CPU (write the reached value, unregister, finish on repaired
  slots — `demoteGpuAll`, unlike the reparent path's early-finishing
  `settleGpuAll`).  A live GPU force run defers compaction
  (`Renderer.forceActive`).  Everything else rides existing
  machinery: resized → mirror capacity-aware realloc + pick-cache
  invalidation; mapper regions rebuild; parent permutation
  re-uploads.  Browser specs pin the visual no-op **byte-identically**
  (labels + bezier bundle + compound + selection), post-compaction
  picking, and a mid-flight animation completing at target.
- **19.5 — triggers + API + sweep.**  Auto trigger (dead > live count
  past a 1024-slot floor) at the safe boundaries (completed remove;
  outermost endBatch), deferring silently while batching or under a
  force run; public `cy.compact()` (throws mid-batch, warns + defers
  under force).  `benchmark/gpu/compaction.mjs` (200k peak → 10%,
  i9-9900K), extended into a four-section sweep (wins / costs /
  forwarding hot path / honesty controls): compact() ~114 ms
  one-shot, and the auto trigger adds it to a removal whose own
  cascade + emits cost ~1.8 s (~6% overhead; store-level removal
  without the trigger is ~0.7 s); held-collection first-touch repair
  of 20k moved refs ~0.5 ms; CPU pick 2.15 → 0.39 ms miss (~5.5×);
  cull dispatch width 200k → 20k lanes per group per frame (edges
  400k → 0); column memory 37 → 4.6 MiB (nodes), 76 → 0 MiB (edges).
  Forwarding is free on the hot path (isCurrent on a current ref
  1.01× with ~180k forward entries present; a stale chase + rewrite
  ~40 ns once per ref), and the controls confirm order-list scans /
  whole-graph bounds are ≈parity (1.1–1.2×) — compaction changes
  exactly what the design said it would.
- **19.5b — the device side, measured.**  The renderer bench gained a
  gpu-only **compaction scenario** (cut to ~10% live through the
  store — eles.remove() would auto-compact the peak state it exists
  to measure — pan at peak slot widths, `cy.compact()`, pan again)
  plus a `--gpu-only` runner flag for gpu-vs-gpu scenarios.  On the
  RX 580: wall time holds the vsync floor on both sides (a 10%-live
  scene is already fast), while the unbounded GPU pass isolates the
  dead-lane overhead — 10k live nodes panned over 100k + 300k peak
  lanes cost 2.2 ms/frame of device time, 0.5 ms once compacted
  (4.4×; ndex 1.4 → 0.9 ms); in-browser compact() is a ~57–62 ms
  one-shot at those scales.

Verification: 28 store-level + 9 ref-level + 5 trigger Node specs
(all seen red first), the full Node suite (2175), and the `webgpu` +
`webgpu-visual` Playwright projects (143 specs — goldens and live v3
parity untouched).  With this round the "Follow-up hooks" list in
`src/gpu/README.md` holds no open architecture items.

## Round 20 plan — interaction options + touch parity (planned 2026-08-01)

With the architecture queue closed (round 19), round 20 takes the
largest remaining "needs a call" cluster: gap item 8 — the
interaction tuning options and the touch gestures v4 still lacks.
Everything here is app-facing parity work; the option names and prop
semantics are permanent API, so the calls are made deliberately up
front (the round-17 discipline).

**Signed-off design calls:**

1. **The option quartet is core-level, with getter/setters.**  v3
   buries `wheelSensitivity`, `desktopTapThreshold` and
   `touchTapThreshold` in renderer options and hardcodes
   `tapholdDuration = 500`; v4 has no renderer-option surface for
   interaction (the `renderer` block is GPU tuning), so all four are
   **constructor options with `multiClickDebounceTime`-style
   getter/setters** — readable and settable at runtime, validated
   (throw on non-finite/negative; `wheelSensitivity` must be > 0),
   live-read by the pointer layer (no re-init).  Defaults are v3's:
   `wheelSensitivity: 1` (a multiplier on the wheel-zoom exponent —
   v4's base rate is unchanged), `desktopTapThreshold: 4`,
   `touchTapThreshold: 8` (css px of movement before a press stops
   being a tap; v4 previously used 4 for all pointer types),
   `tapholdDuration: 500` ms (v4 makes v3's constant configurable —
   the one deliberate surface addition, logged in the gap list).
   v3's console warning on a custom `wheelSensitivity` is **kept
   verbatim** (the hardware-variance advice is as true under WebGPU;
   emitted once per instance, from the setter or ctor).
2. **`events` is a style prop compiled to a flag bit.**  v3's
   `events: 'yes' | 'no'` ports to both element groups (default
   `'yes'`), constants or `case` mappers (CPU-evaluated — a flag
   write, like every non-paint channel).  The engine maintains a new
   store-managed `FLAG_NO_EVENTS` bit; **every pointer path excludes
   flagged elements by reading the one bit**: the CPU node pick
   (grab/tap targeting, hover, tapdragover), the GPU edge pick tile
   (the cull kernels gain a `pickMode` Frame field and drop flagged
   edges in pick mode only — scene draws are untouched: `events: no`
   elements still render), and the **box-selection gesture** (v3's
   `getAllInBox` runs over the `interactive` set, so `events: no`
   elements are not box-selectable; the gesture filters, while
   `cy.elementsInBox()` stays a pure geometric query — a recorded
   scope note).  `interactive()` becomes
   `visible() && events !== 'no'`.  An `events` flag change
   invalidates the pick-tile cache (it changes pick answers, not
   pixels).
3. **`text-events` is node-only in v4.**  v3's default is `'no'`
   (labels are pointer-transparent), which v4 already matches; the
   port makes `'yes'` mean *the node's label box is part of the node
   for picking* — the CPU pick tests the exact laid label block at
   its D3 anchor (the round-16 dims; node labels never rotate, so
   the test is an AABB in model space) after the shape test misses.
   Constants or `case` mappers, `FLAG_TEXT_EVENTS`.  **Edge labels
   stay unpickable** whatever the prop says (edges pick through the
   GPU tile, which draws edge geometry only; the label quads are a
   different stream — a recorded deviation, consistent with the
   round-10 "labels are not pickable" rule).  The label bb term
   already rides `boundingBox({ includeLabels })`, so no bounds work.
4. **Touch gestures port v3's rules verbatim.**  Two-finger cxt: a
   second finger landing within 200 css px of the first starts the
   cxt gesture — `cxttapstart` on the node under finger 1 (else
   finger 2, else the core; the synchronous CPU pick), `cxtdrag`
   (+ `cxtdragover`/`cxtdragout`) while the pair moves, **cancelling
   into a pinch** when the finger distance grows past 1.5× or 150 px
   (`cxttapend` fires, then the pinch machinery takes over),
   `cxttapend` + `cxttap` (when never dragged) on release.  A
   two-finger press *farther* than 200 px apart pinches immediately
   (v3's threshold).  Three-finger box: with `boxSelectionEnabled`,
   three fingers select — the box spans the start centroid to the
   moving centroid (v3's `(f1+f2+f3)/3` corners), `boxstart` on the
   first move, applied through the existing box flow (boxend / box /
   boxselect + the round-16.5 label containment option) when the
   third finger lifts; a gesture that boxed never degrades to a
   pinch (v3's `didSelect` latch).  Both gestures ride the existing
   pointer-event handlers (v4 has no touch-event path by design).
5. **Closed or deferred without building:** `pixelRatio` turned out
   to be **already landed** (ctor option, `'auto' | number`, plumbed
   to the renderer's dpr — this round adds the missing spec + docs
   and records it); a box-selection **overlap mode** is *not* v3
   surface (v3 selects by containment) and is **deferred as a
   demand-gated hook** — the logged shape is a
   `boxSelectionMode: 'contain' | 'overlap'` core option whose
   overlap test is bb-intersect for nodes and segment/route-vs-rect
   for edges (the cull pass already owns that math).

**Pass split** (tests-first per item; docs in-commit):

- [x] **20.0 Docs-first** (2026-08-01) — this plan section; gap
  item 8 marked scoped.
- [x] **20.1 The option quartet** (2026-08-01) — `wheelSensitivity`,
  `desktopTapThreshold`, `touchTapThreshold`, `tapholdDuration`:
  ctor options + validated getter/setters on the core (throws on
  non-finite/negative; wheelSensitivity must be > 0 and keeps v3's
  once-per-instance warning on non-default values, from ctor or
  setter), read live by the pointer layer — the wheel exponent
  gains the multiplier (base rate unchanged), press-move thresholds
  resolve per event by pointer type (touch 8 / desktop 4 — v4
  previously used 4 for both), and the taphold timer takes the
  configured duration.  Tests-first: 4 Node specs
  (`test/gpu-interaction-options.mjs`, red then green) for the
  option surface incl. the warn-once rule, and a `webgpu`
  Playwright spec pinning behavior — sensitivity 2 doubles the
  zoom log-ratio of an identical wheel tick; a 6 px desktop
  press-move drags at threshold 4 and taps (position unmoved,
  `tap` fired) at threshold 10; a 350 ms hold fires no `taphold`
  at duration 5000 and fires it at 150.  2179 Node tests,
  typecheck + lint clean.
- [x] **20.2 `events`** (2026-08-01) — the prop lands exactly as
  called: an enum channel on both groups (constants or `case`
  mappers) whose write() maintains `FLAG_NO_EVENTS`; the CPU node
  pick scans past flagged slots (grab/hover/tap fall through to
  what's beneath), the Frame uniform grew a `pickMode` field (18
  floats, one struct for every pass; scene/export leave it 0) and
  both edge cull kernels drop flagged edges in pick mode only; the
  box gesture filters to `interactive()` (which now folds the
  flag); the flags-column dirty span already invalidates the
  pick-tile cache (setFlag no-ops on unchanged bits, so restyles
  don't churn it).  Tests-first: 6 Node specs
  (`test/gpu-events-prop.mjs`, red then green — defaults, readback,
  validation, case-mapper refresh on data writes, the
  elementsInBox-stays-geometric scope note, CPU-pick
  pass-through) and a `webgpu` Playwright spec (a blue `events: no`
  node still wins the pixel but hover *and* a drag pass through to
  the node beneath; a `cy.pick` on an `events: no` edge answers
  null and flips live after a restyle — the same-cursor pick-cache
  pin; the box gesture selects and box-events only the interactive
  elements).  2185 Node tests, 143/143 Playwright, typecheck +
  lint clean.
- [x] **20.3 `text-events`** (2026-08-01) — node-only enum channel
  (constants or `case` mappers) maintaining `FLAG_TEXT_EVENTS`; the
  CPU pick tests the label block box (`store.nodeLabelBox`, the
  round-16.4 laid dims at the D3 anchor — now on the ModelView
  contract) in device px before the body's quick reject, so label
  hits resolve the node for tap/grab/hover alike; `events: 'no'`
  still wins (checked first).  **Call finalized during the pass**
  (the plan draft waffled between parse-inert and throw): the
  edges group **throws** — accepting an inert prop would be a
  silent no-op, against the unknown-keys-throw rule; edge labels
  stay unpickable (recorded).  Also recorded: the label box picks
  even when the label is LOD-faded (labelFadePx is a readability
  threshold, not a pick predicate).  Tests-first: 5 Node specs
  (`test/gpu-text-events.mjs`, red then green — default/readback,
  edges-group throw, case mapper, label-box pick on/off, the
  events-wins rule) and a `webgpu` Playwright spec (a click on the
  label below the node background-taps under the default and
  selects the node under `text-events: 'yes'`).  2190 Node tests,
  typecheck + lint clean.
- [x] **20.4 Two-finger cxt** (2026-08-01) — the v3 split lands in
  the pointer layer's touch bookkeeping: a second finger closer
  than 200 css px starts the cxt gesture (`cxttapstart` on the node
  under finger 1, else finger 2, else the core — the sync CPU
  pick), the pair moving emits `cxtdrag` + `cxtdragover`/`out`
  (via the existing 17.3 drag-hover pick), spreading past 1.5× or
  150 px cancels into a pinch (`cxttapend`, pinch rebased at the
  current spread — no zoom jump), and either finger lifting ends it
  (`cxttapend` + `cxttap` when never dragged, never on
  pointercancel) with the leftover finger inert, like a pinch's.  A
  pair ≥ 200 px apart pinches immediately, so the two existing
  pinch specs' fingers moved to 220 px spacing (they'd have started
  cxt gestures under the new rule — exactly v3's behavior).
  Recorded deviation: `cxtdrag` thresholds on finger-1 movement
  past `touchTapThreshold` (v4's mouse cxt rule) where v3's touch
  cxt fires on any move event.  Pinned in a `webgpu` Playwright
  spec (four synthetic-touch scenarios: close-pair tap on the node
  → exactly cxttapstart/cxttapend/cxttap; parallel background drag
  → cxtdrag, no cxttap, no pinchzoom; spread → cxttapend then
  pinchzoom with the zoom actually rising; far pair → pinch only),
  verified red against the pre-20.4 pointer layer before the
  implementation was restored.  80/80 webgpu Playwright specs,
  2190 Node tests, typecheck + lint clean.
- [x] **20.5 Three-finger box** (2026-08-01) — v3's centroid box on
  the pointer layer: three fingers (with `boxSelectionEnabled`)
  sweep from the start centroid (+1 px seed, v3) to the moving
  centroid, `boxstart` on the first move, the themed DOM box drawn
  live (the overlay/styling shared with the mouse box via a new
  `showBoxRect` helper), applied on any box finger's lift —
  boxend/box/boxselect through `elementsInBox` (so the 16.5 label
  option applies) filtered to `interactive()` (the 20.2 rule), and
  **additive** as v3's touch box is (it never clears the prior
  selection).  The box preempts a pinch in progress (v3's
  touchmove branch order) and the didSelect latch keeps leftover
  fingers inert until all lift.  **Design call, recorded**: a third
  finger landing on an *undragged* cxt pair converts it to the box
  gesture (`cxttapend` first) — pointer events land fingers
  sequentially, so v3's simultaneous three-finger landing has no
  direct v4 equivalent, and without the conversion the gesture
  would be unreachable over close pairs.  An aborted gesture
  (pointercancel) hides the box and selects nothing.  Pinned in a
  `webgpu` Playwright spec (close-pair + third finger →
  cxttapstart/cxttapend then boxstart/boxend/boxselect of exactly
  the swept nodes, zoom + pan byte-unchanged, leftover fingers
  inert; boxSelectionEnabled off → no box events, nothing
  selected), verified red against the pre-20.5 pointer layer.
  81/81 webgpu Playwright specs, 2190 Node tests, typecheck + lint
  clean.
- [x] **20.6 pixelRatio spec + closing docs sweep** (2026-08-01) —
  the `webgpu` spec confirmed the pre-existing option end to end
  (`pixelRatio: 1` → backing store = css size, `2` → doubled, and
  `cy.pick` at css coordinates still resolves the node), so no
  code was needed.  Closing sweep per the standing rule: both docs
  grepped for the round's vocabulary and staleness markers — fixed
  the round-10 deferred list (12c/compounds/z-index/GPU
  layouts/multiline/three-finger entries all stale since their
  rounds landed), trued up both file headers with rounds 19–20,
  and recorded pixelRatio + the touch-box close in their sections.
  **Round 20 is complete**: 2190 Node + 63 module tests, 147
  Playwright specs (webgpu + webgpu-visual — goldens untouched),
  typecheck + lint clean.

**Risks tracked**: Frame-uniform layout change touches every pass
(one struct, asserted by the existing goldens — any misalignment is
loudly visual); pick-cache staleness on `events` writes (spec pins a
flag flip between two picks at the same cursor); touch synthesis
fidelity in Playwright (the pinch spec's synthetic-pointer precedent;
gestures are driven through pointer events, so no Touch APIs needed);
threshold semantics drift (the pointer layer must pick the threshold
by `pointerType` per event, not per instance).

## Design sitting (2026-08-01, third) — animation trims; display/visibility; charts

Three calls taken with the user (quick answers, follow-up expected on
the finer points), scoping rounds 21–23:

1. **v4 animations do not have to match v3, and the queue goes.**
   The per-element animation queue exists to sequence animations —
   which promises already do better (`await a.promise()`); it was
   valuable pre-promises, not now.  v4 drops queueing outright (there
   is no `queue: false` option because there is no queue), and the
   v3 `step` callback stays out (v4 never had it; `onRender` +
   promises cover progress observation).  The rest of the v3 surface
   (`pause`/`progress`/`reverse`/`apply`, style transitions) stays
   **logged open for follow-up** — not built, not dropped.
   Scoped as **round 21**.
2. **`display` and `visibility` both exist — the distinction is
   useful.**  Two tiers with different use cases: structural hiding
   (no space) vs paint-only invisibility (space kept).  The
   motivating cases: **bundled beziers** — structurally hiding a
   bundle member should re-fan its siblings, while making it
   invisible must keep every rank stable (no sibling jump) — and
   **compound nodes** — a display-hidden child leaves its parent's
   auto-bounds, an invisible child still sizes it.  Scoped as
   **round 22**.
3. **Pie/stripe backgrounds: yes — designed as a charts surface.**
   Ported not as v3's 101 numbered props but as a lean list-valued
   `chart` family designed to grow into other chart kinds later
   (the pie hole is a first instance: donuts fall out of the same
   surface).  Scoped as **round 23**.

Gap-list updates: item 9 (animation surface) partially resolved by
call 1 (queue/step decided; controls + transitions remain the open
follow-up — since scoped and landed as round 24, fourth sitting);
item 11 (display vs visibility) resolved by call 2;
item 3 (pie/stripe) resolved by call 3.

## Round 21 plan — animation queue removal (planned 2026-08-01)

**Signed-off design calls:**

- **No queue, concurrency by channel.**  The manager keeps a set of
  *concurrently running* animations per element (and for the
  viewport) instead of a queue: starting an animation whose channels
  are **disjoint** from every running one's runs it immediately
  alongside them (position tween + opacity fade compose); starting
  one that **overlaps** a running animation's channels stops that
  older animation in place (its promise resolves, values freeze
  where they are, any GPU lease settles) and the new one captures
  from the frozen state — whole-animation eviction, never a
  half-stopped animation.  Sequencing is the caller's job via
  `await a.promise()`.
- `delay` stays (it is part of one animation's timeline, not
  queueing).  `play`/`stop`/`promise`/`playing`/`animated` keep
  their shapes; `stop()` stops every running animation on the
  collection.
- Recorded: this is a deliberate v4 divergence from v3's
  queue-by-default (user-approved 2026-08-01); v3's `queue: false`
  option spelling is rejected (unknown-keys-throw — there is no
  queue to opt out of).

**Pass split** (tests-first; docs in-commit):

- [x] **21.1** (2026-08-01) — the manager rework landed: the
  per-element queues became per-element *running sets*
  (`start()` replaces `enqueue()`), eviction compares
  `touchedColumns()` (position → node.position; style channels →
  their columns; a delay() no-op touches nothing and composes with
  everything) across shared refs and stops the older animation in
  place via the existing GPU-settling stopOne; the viewport
  composes pan and zoom as separate channels; `tick` advances
  every running animation (dedup across refs) and `stop()` stops
  them all — its `clearQueue` argument is gone from
  `eles.stop`/`cy.stop` (no queue to clear).  `queue`/`step`
  option spellings throw with pointers at promises/onRender.
  settle/demote/onCompacted iterate the running sets, so the GPU
  lease, compaction-demotion and ref-repair paths carry over —
  pinned by the untouched compaction + tween suites.  Tests-first:
  the old runs-in-sequence spec replaced by 6 concurrency specs
  (red then green — in-place eviction with frozen values + resolved
  promise, disjoint-channel composition on one element, stop()
  stopping all, delay() never evicting, viewport pan/zoom
  composition with pan-evicts-pan, the queue/step throws).
  2195 Node tests, 82/82 webgpu Playwright specs, typecheck +
  lint clean.  **Round 21 is complete.**

## Round 22 plan — display/visibility split (planned 2026-08-01)

**Signed-off design calls:**

1. **`show()`/`hide()` stay the display tier** (structural, element
   state): no draw, no pick, no space — excluded from bb/fit and
   compound auto-bounds (already true) — and, **new**, a hidden
   `bezier`-styled bundle member leaves its bundle: siblings re-fan
   (v3's display semantics; v4 previously kept the rank, which is
   visibility semantics).  Same rule for the per-node loop stagger
   and compound-loop member index.  A hidden *node* needs no bundle
   work: every member of a pair shares both endpoints, so the whole
   bundle disappears together — recorded.
2. **`visibility` is a style prop** (`'visible' | 'hidden'`, both
   groups, default visible, constants or `case` mappers — the v4
   mechanism for per-element variation; there is no element-state
   setter).  Paint-only: an invisible element draws nothing but
   **keeps its space** — bb/fit, compound auto-bounds, layouts and
   bundle ranks all unchanged — and is not pickable, not hoverable,
   not box-selectable (`interactive()` rides `visible()`).
   Ancestor-gated for nodes (v3: descendants of an invisible parent
   are invisible); an edge is additionally invisible while either
   endpoint is (rides the kernels' existing endpoint tests).
3. **Mechanism: one derived bit, one WGSL constant.**  The style
   engine maintains `FLAG_SELF_INVISIBLE`; the store derives
   **`FLAG_DRAWN`** (= effective shown AND no invisibility on self
   or, for nodes, any ancestor) in the same subtree walk that
   maintains effective `FLAG_VISIBLE`.  The WGSL `SHOWN` constant
   redefines from `ALIVE|VISIBLE` to `ALIVE|DRAWN`, so **every**
   cull kernel, vertex shader, depth prepass and glyph/ghost/layer
   stream honors visibility with zero per-kernel edits and zero new
   bindings; CPU picking tests DRAWN; bb/fit/box-geometry scans keep
   testing VISIBLE (space semantics — invisible elements stay in).
4. **Getter semantics** (v3's): `visible()` = drawn (edges fold
   endpoints); `hidden()` its negation; `takesUpSpace()` = the
   display tier alone (shown, whatever the visibility — it may now
   differ from `visible()`); `interactive()` = `visible()` && the
   20.2 events rule.  Readback: `style('visibility')` from the flag.

**Pass split** (tests-first; docs in-commit):

- [x] **22.1 Store + prop** (2026-08-01) — FLAG_SELF_INVISIBLE +
  FLAG_DRAWN landed with the derivation folded into
  refreshEffectiveVisibility (one subtree walk maintains both bits;
  a drawn-only change skips the geo/auto-bounds invalidation —
  invisible elements keep their space), `setInvisibility` as the
  style write's entry, `isDrawn(ref)` folding edge endpoints, the
  `visibility` prop (parse/readback/case mappers, both groups) and
  the getter updates (`visible()` = drawn + endpoint fold — v3's
  edge rule, now implemented; `hidden()` its negation;
  `takesUpSpace()` = the display tier).  **Two pre-existing space
  gaps closed en route**: the whole-graph fit scan
  (`store.boundingBox`) and the collection `boundingBox()` never
  filtered display-hidden elements — both now skip unshown
  elements (and edges with unshown endpoints), v3's rule, while
  deliberately including invisible ones.  7 Node specs
  (`test/gpu-visibility-prop.mjs`, red then green) + the
  cpu-pick hidden-node spec moved onto the real hide path.
- [x] **22.2 Renderer** (2026-08-01) — the WGSL `SHOWN` constant
  flipped to ALIVE|DRAWN (one line — every cull kernel, the depth
  prepass and all glyph/ghost/layer streams honor visibility with
  zero new bindings; scene pixels for fully-visible graphs are
  untouched, pinned by the unchanged goldens) and the CPU pick
  masks the same way.  Playwright: an invisible node paints
  nothing (body + label + incident edge via the endpoint test)
  while `fit()` still frames it; a tap where it sits
  background-taps; a restyle to visible returns the pixels; and a
  display-tier `hide()` then shrinks the fit box (the
  22.1-closed gap, pinned).
- [x] **22.3 Bundle re-fan** (2026-08-01) — `CurveHost.edgeShown`
  (reads FLAG_VISIBLE — the display tier by construction),
  `onEdgeShownChanged` marking the pair/loop on hide/show (wired
  from `setVisibility`; no-op for straight-only graphs until the
  pair index exists), and derivation filters: hidden members leave
  the bundle array, the compound-relation index and the loop
  stagger, and their own params freeze until a show() re-derives.
  Visibility flips never touch the curve index, so invisible
  members keep every rank by construction.  2 Node specs (red then
  green): hiding a 3-bundle's middle re-fans the outer pair (and
  show() restores byte-exact params); an invisible middle keeps
  the 3-bundle stagger byte-identical against a reference
  instance.  2204 Node tests, 148/148 Playwright (goldens
  untouched), typecheck + lint clean.  **Round 22 is complete.**

## Round 23 plan — node charts: pie + stripes (planned 2026-08-01)

v3's 51 + 50 numbered props (`pie-1-background-color` ...
`stripe-16-background-size`) return as a **lean, list-valued chart
family** designed to grow more kinds later — the user's call
(2026-08-01): definitely port, and shape the surface for future
chart types.

**Signed-off design calls:**

1. **The `chart` family** (node-only): `chart`
   (`none | pie | stripes` — the open enum future kinds extend),
   `chart-values` (a number list — a constant array, or the
   `{ data: key }` passthrough reading a **per-element array** from
   the data sidecar, the headline capability: data-driven pies),
   `chart-colors` (a constant color list *or* a named scheme string
   from the mapper DSL's palette table — `'category10'` is the
   default), `chart-size` (fraction or `'N%'` of the node box,
   default 100%), `chart-hole` (0–1 inner cutout — donuts from the
   same surface, v3's `pie-hole` analogue), `chart-start-angle`
   (pie; v3's `pie-start-angle`, default 12 o'clock),
   `chart-direction` (stripes: `horizontal | vertical`) and
   `chart-opacity` (folds into slice alphas, the B1 pattern).
   Values are **absolute fractions of the whole** (v3's percent
   semantics: a sum under 1 leaves unpainted remainder, over 1
   clamps at 1) — no normalize option for now, apps can normalize
   (recorded).  Slice count caps at 16 (v3's N; recorded).
2. **Storage: a chart blob record per element** ([kind, config,
   n, then n × (value, packed rgba)]) in a round-11-compacting blob
   pool behind a packed `node.chartRef` column — colors resolve at
   style-write (constants-only props bake per record).
   `chart-values` via `{ data }` refreshes on writes of the mapped
   key like any mapped channel; every other chart prop is
   constants-only except `chart` itself and `chart-opacity`
   (mapper-capable enums/numbers).
3. **Rendering: in the node FS, SDF-native.**  A `chartRef == 0`
   early-out keeps unused cost ~zero; pie tests the fragment's
   local angle against cumulative stops (start at 12 o'clock,
   clockwise — v3), stripes test the local coordinate; both clip to
   the node's shape SDF and the `chart-size`d box, draw **over**
   fill/gradient/background-images and **under** border/outline
   (v3's order), and AA at slice boundaries analytically.  Charts
   are paint-only: never in bb, never pickable, no cull impact.
4. **Verification**: Node specs (parse/readback/blob/refresh),
   goldens (pie fractions incl. remainder gap + hole + start angle;
   stripes both directions), and a **live v3 parity scene** mapping
   `chart` pies onto v3's `pie-i-*` props (and stripes onto
   `stripe-i-*`) at matching geometry.

**Pass split** (tests-first; docs in-commit):

- [x] **23.1 Props + model** (2026-08-01) — the 8-prop surface
  parses/validates/reads back (chart + chart-opacity mapper-capable;
  values as arrays or space-separated strings, or the
  `{ data: key }` passthrough reading per-element arrays with a new
  'chart' dep kind + narrow refresh path beside the label one;
  colors as lists or named schemes with category10 the default,
  cycling past their length; size/hole as [0,1] fractions or 'N%';
  start-angle via the shared angle parser; direction
  vertical | horizontal; every list/config prop constants-only).
  Records live in a chart blob (round-11-compacting CurveBlob pool,
  compaction-remapped) behind the packed `node.chartRef` column —
  header kind/size/hole/startAngle/direction/opacity/n then
  n × (value, r+g·256, b+a·256): colors split across small-integer
  floats (packed u32 bits would risk NaN canonicalization through
  the f32 pool), alpha-folded with the exact opacity kept in the
  header for readback.  Slices cap at 16 (v3's N) and the running
  total clamps at 1 (v3's percents; the remainder stays unpainted);
  invalid sidecar entries skip; a chartless write frees the record
  (as does removal).  Tests-first: 10 Node specs
  (`test/gpu-charts.mjs`, red then green).  2214 Node tests,
  typecheck + lint clean.
- [x] **23.2 Render** (2026-08-01) — a dedicated ChartPipeline (the
  node FS sits at its 8-buffer cap, so charts get their own pass —
  the image pipeline's shape: one quad per charted node off the
  culled visible lists, leaves after the image pass and parents
  after theirs, chartless instances collapsing in the VS, the whole
  pass skipped at chartCount 0).  The FS clips to the node shape at
  the border's inner edge (poly blob bound for custom polygons),
  resolves the fraction coordinate (clockwise from 12 o'clock for
  pies — v3; the advancing axis for stripes) and walks the record's
  stops with px-space AA into the neighboring region (wrapping
  across the start angle on full pies), radial AA at rim + hole,
  sub-box edge AA for stripes; element opacity multiplies;
  derivatives hoist above every branch (WGSL uniformity, caught by
  the device-error guard).  The chart blob mirrors beside the image
  blob.  Two fixes shaken out by the golden: the chart-refresh fast
  path re-routes through the full mapped write when the def has
  mappers (the narrow path wrote the constants record — wrong when
  `chart` itself is case-mapped), and the scalar/enum chart props
  joined the mapper-capable set (the 12b constants-only rule covers
  lists, not scalars).  Pinned by the `charts-pie-stripes` golden:
  full pie on the default palette, remainder gap, donut with start
  angle on a bordered ellipse, both stripe directions,
  chart-size < 1.
- [x] **23.3 Parity + close** (2026-08-01) — two live v3 parity
  scenes: pies against the numbered `pie-i-*` props at **0.000%**
  (pixel-exact — fractions, remainder, hole, start angle) and
  stripes against `stripe-i-*` at 0.005%.  **Two upstream v3
  stripe bugs found and recorded** (they constrain the parity
  scene to vertical square-node stripes; the golden pins v4's
  horizontal + non-square behavior): v3's
  `stripe-direction: horizontal` is inert — the canvas draw switch
  tests a typo'd 'righward' keyword its own style type rejects —
  and `drawStripe` swaps W/H in its centering offsets, visible on
  non-square nodes.  The planned `debug/webgpu` toggle was dropped
  (the golden + parity scenes cover the visual surface; recorded).
  2214 Node tests, 151/151 Playwright, typecheck + lint clean.
  **Round 23 is complete.**

## Design sitting (2026-08-01, fourth) — style transitions + animation controls

The open half of gap item 9, scoped with the user as **round 24**.
Calls taken:

1. **Transitions are in** — the `transition-property`/`-duration`/
   `-delay`/`-timing-function` family returns as sugar over the
   animation system.  The trigger taxonomy is v4-specific (no
   classes, no bypass): a transition fires whenever an element's
   *resolved* channel value changes through a restyle — sheet
   re-application, mapper re-evaluation on data writes (`case`
   clause flips, scale output moves, auto-domain extent shifts) and
   structural restyles (leaf↔parent flips, structural `case`
   conditions).  **Instant on add** (v3's rule — a new element's
   first style application never tweens from channel defaults).
   Non-triggers, recorded: `visibility`/`show`/`hide` flips (flags,
   not tweenable channels — fade is spelled with an `opacity`
   transition) and descendant effective-opacity folds (they follow
   an ancestor's tween per tick; no per-descendant transitions).
   Batched writes capture at the outermost `endBatch` — one
   transition per *net* change.
2. **Interruption: latest wins, uniformly.**  The round-21
   channel-eviction rule applies with no priority tiers: whichever
   starts later (transition or user animation) captures from the
   current mid-flight value and stops the older one in place, both
   directions.
3. **`transition-property` accepts every prop name from day one;
   executors are tiered.**  Number/color channels that are
   animatable today actually tween — the paint set (opacity,
   background/border/line colors, with the arrow-alpha fold riding
   along) on the GPU bulk path, `border-width` on the CPU path —
   while discrete channels (enums, strings, lists) snap at the
   transition's start (CSS's rule, recorded) and the not-yet-
   animatable geometry numerics (`width`/`height`, `font-size`,
   `padding`, edge `width`) snap too, **logged as the
   geometry-tween follow-up round**: their per-tick invalidation
   cascade (curve re-derivation, compound auto-bounds, label
   anchors) is the same work the width/height *animation* follow-up
   needs, so both land together, once, with benchmarks.  The API
   surface never changes when that round lands.
4. **Whole-channel transitions must be one bulk tween record** —
   a slot list + packed from/to buffers (the round-9.4 shape),
   never per-element Animation objects.  This keeps the
   auto-domain-shift worst case (one write moves the live extent →
   the whole channel re-derives) in the cost class it already
   occupies today: the O(n) re-derive plus a constant (one stored-
   channel read for the from values, one from/to upload, ~zero per
   frame while running).
5. **The domain performance contract** (user's condition: both
   modes stay supported).  Explicit `domain` — already in the
   round-7 DSL, no new mapper type — is the documented escape
   hatch: with a pinned domain a data write re-evaluates *written
   elements only* (O(changed), never whole-channel); with
   `'auto'`, in-range writes are identically O(changed) and only
   extent-moving writes pay the O(n) re-derive.  Recorded as docs
   guidance (mapper docs + transition docs): auto is the ergonomic
   default, pin `domain` when a stream grows its own extent.  No
   warning machinery.
6. **Controls: `pause`/`resume`/`reverse` land; `progress` stays a
   getter** (no scrubbing), and v3's `apply`/`applying` stay out
   (promises cover the use case; one name per concept).  A paused
   GPU tween settles its lease (values freeze on the CPU) and
   re-acquires on resume.

## Round 24 plan — style transitions + animation controls (planned 2026-08-01; landed in full the same day — see the pass records below)

**Signed-off design calls**: the fourth-sitting record above —
trigger taxonomy with instant-on-add, uniform latest-wins eviction,
all-props-accepted with tiered executors (paint tweens now, discrete
+ geometry snap, geometry-tween round logged), bulk-record
whole-channel transitions, the auto-vs-explicit domain contract, and
the `pause`/`resume`/`reverse` control set.

**Pass split** (tests-first; docs in-commit):

- [x] **24.1 Transition props + CPU path** (2026-08-01) — landed as
  planned, with the trigger detection shaped as **one mechanism**:
  the four props split out of each sheet block at compile
  (per-group `TransitionSpec`; the parents def merges
  nodes-then-parents under v3's order precedence; constants-only —
  mapper values throw; `transition-property` accepts arrays or
  space-separated strings and validates every name against the
  group's read set, so unknown or wrong-group names throw while
  discrete/geometry names are accepted and snap), and a **capture
  wrap around the one channel funnel** (`write()`): any apply pass
  under a configured spec (sheet re-application, the mapper refresh
  paths — case flips, scale moves, auto-extent escalation,
  structural `::parent` refreshes, the leaf↔parent flip restyle —
  and the batch flush) snapshots the tweenable columns per slot
  before the write, diffs **stored truth** after it, restores the
  old value (the store holds the pre-restyle state until the first
  post-delay tick — CSS's delay rule, and no target flash), and
  packs the accumulated diffs into **bulk per-column ChannelWrites**
  wrapped in one preset Animation started through the round-21
  manager — so latest-wins eviction between transitions and user
  animations falls out in both directions with zero new eviction
  code.  Instant-on-add is a per-slot **styled-generation mark**
  (gen + 1; recycled slots fail on their fresh generation; marks
  refresh on slot compaction), which also makes the batch flush's
  applyAll net-change-correct with no call-site special-casing.
  Diffing stored truth gives the fold semantics for free, recorded:
  channel-opacity folds ride the color they fold into, and an
  edge-`opacity` transition carries the pre-folded arrow alphas
  along as ride-along color writes (only when the opacity itself
  moved).  Tweenable set = the animation system's channels
  (opacity both groups, background/border/line colors,
  border-width); preset animations derive `touchedColumns`/
  `gpuEligible` from their writes (all-paint may offload — 24.2's
  hook; border-width stays CPU).  Tests-first: 23 Node specs
  (`test/gpu-transitions.mjs`, red then green) — the full trigger
  matrix (sheet swap, add, case flip, scale move, auto-extent
  shift, explicit-domain confinement, batch net-change + batch-add,
  parent flip, show/hide non-trigger, zero-duration), snap tiers,
  eviction both directions, delay, edge line-color, the arrow
  ride, and prop parse/validate/readback.  2237 Node tests,
  63 module tests, 151/151 Playwright (goldens untouched — rendered
  scenes without transitions are pixel-identical under the capture
  wrap), typecheck + lint clean.
- [x] **24.2 GPU bulk path + scale proof** (2026-08-01) — the
  offload came almost free from 24.1's preset shape: an all-paint
  preset reports `gpuEligible` and the manager registers its
  ChannelWrites with the existing gpu-tween kernels verbatim, so
  the only new renderer-side code is a **demotion rule**: a listed
  transition prop's mapper eval can not be kernel-owned (the diff
  reads stored truth on the CPU, which is stale exactly when the
  kernel owns the channel) — `paintInputs` demotes every prop in
  the group's spec (the parents overlay's spec too, under
  compounds); transitions and mapper kernel eval are mutually
  exclusive *per channel*, while the tween itself still runs
  on-device (different kernels).  Playwright (both discriminating,
  in the `webgpu` project): a sheet-swap transition tweens pixels
  through OKLab while `style()` reads the pre-restyle value (the
  motion-staleness rule) and settles on the exact resolved end
  state; a scale-mapper transition on a data write tweens rather
  than snapping — the spec fails on the mid-flight green>red
  strictness if the demotion is removed.  Scale proof
  (`benchmark/gpu/transitions.mjs`, headless 200k nodes): the
  auto-extent shift's whole-channel re-derive is 326 ms off →
  594 ms with transitions (1.82× — the diff + restore + bulk spawn
  is a constant factor, not a new class); the explicit-domain
  write is 4.2 → 6.8 µs (O(changed) pinned — ~2.6 µs to diff and
  spawn a one-element tween); a whole-sheet swap is 1.46 → 1.67 s
  (1.15×); and the spawned 200k-slot tween costs 15 ms per CPU
  tick — the number the GPU offload deletes (all-paint presets
  tick on-device at ~zero CPU, the round-9.4 contract).  The
  domain-contract browser spec folded into the Node spec + the
  benchmark's explicit-domain group (recorded).  2237 Node tests,
  153/153 Playwright (2 new), typecheck + lint clean.
- [x] **24.3 Controls** (2026-08-01) — `pause()`/`resume()`/
  `reverse()` on the Animation handle (element and viewport alike),
  plus read-only `progress()` and `paused()` introspection
  (`progress` is a getter only — no scrubbing; `apply`/`applying`
  stay out).  Timeline semantics: pause freezes elapsed in place
  (values hold, the promise stays pending, `playing()` reads false)
  and resume shifts the start clock by the paused span; reverse
  swaps every write's from/to halves (and the viewport targets) and
  remaps elapsed to 1 − t, so the current value is continuous —
  exactly for point-symmetric easings (linear included; v3's
  start/end swap carried the same rule) — and reversing inside the
  delay completes at the captured start state.  The controls read a
  `lastNow` clock the manager stamps every advance, so they stay
  deterministic under test-driven ticks.  GPU lease: pause and
  reverse settle a GPU-driven animation's exact current value onto
  the CPU and release the device (`applyNow` — a settle that does
  not finish); resume/the next advance re-registers through the
  normal eligibility path with the shifted clock (pinned: the
  re-registered start keeps 160 − start = elapsed, and a reversed
  re-registration uploads the swapped from/to).  A paused animation
  still owns its channels — the round-21 eviction stops it like any
  running one (pinned).  Tests-first: 11 Node specs
  (`test/gpu-animation-controls.mjs`, red then green) — timeline
  shift, pending promise, stop-on-paused, eviction-of-paused,
  reverse continuity + delay edge, progress states, both mock-sink
  lease specs, and the viewport.  2248 Node tests, 63 module tests,
  153/153 Playwright, typecheck + lint clean.
- [x] **24.4 Docs closing sweep** (2026-08-01) — README trued up:
  the top summary carries round 24, the sheet listing carries the
  `transition-*` config, the promise-sequencing bullet's "open
  follow-up" became the landed controls paragraph (24.3 commit),
  the animation-surface listing carries the handle controls, and
  the mapper DSL bullet carries the domain performance contract
  (O(n) auto-extent vs O(changed) explicit — the transitions
  bullet holds the long form and the measured numbers).  PLAN.md:
  gap-ledger item 9 closed (round 24 landed in full 2026-08-01);
  the sequencing tail names the **geometry-tween round**
  (size-channel transitions + animation, one benchmarked round
  with the per-tick invalidation cascade) as the successor open
  follow-up.  **Round 24 is complete.**

## Round 25 plan — geometry tweens (planned 2026-08-02)

The follow-up round 24.4 logged: the geometry numerics —
node `width`/`height`, edge `width`, `font-size`, parent `padding` —
become animatable and transition-tweenable, with the per-tick
invalidation cascade built once and benchmarked.  The API surface
does not change (the fourth sitting's call): `transition-property`
already accepts these names and `animate({ style })` starts
accepting them; what changes is that they tween instead of
snapping/throwing.

**Code investigation (2026-08-02, precedes this plan)** — every
consumer of node size / edge width / font-size classified as
live-read vs derivation-baked:

- Node size is read **live** by nearly everything: node/ghost/
  overlay/underlay/image/chart quads and their cull extents, CPU
  pick, `refsInBox`, `boundingBox`, endpoint clipping, haystack
  offsets, taxi/segment/bezier evaluation (curve *derivations* are
  size-free).  Exactly two consumers bake it: **label anchors**
  (sidecar `anchorX`/`anchorY` + the glyph run's baked offsets —
  today only the style engine's same-pass `writeLabel` keeps them
  in sync, and the store's `reanchorLabel` covers only the parent
  auto-bounds path) and the **compound-loop excursion bound** `p2`
  (cull slack only; drawn CMPD geometry is live).  The CMPD
  invalidation lives only in `materializeParentGeom`, so it has a
  pre-existing hole: a child size change that does not move the
  parent's box (non-extremal child, or a min-size-pinned parent)
  never refreshes the bound.  Slack meters (`nodeHalfMax`,
  `borderMax`) are monotone grow-only — sound under tweens.
- Edge width is read live by the quad/strip expansion, arrow
  sizing and edge cull; three derived channels bake it at
  style-write, all **linear in width**: `edge.arrowWidths` under
  `match-line`/percent, `edge.casing` stroke (width + outline
  width), `edge.overlay`/`edge.underlay` strokes (width +
  2·padding).
- Font-size is baked into the glyph instances in model px (the
  build is per-label incremental, never whole-stream), and the
  shaping memo keys on `maxWidth/fontSize` — a tween would miss
  (and grow the memo) every tick, `GlyphBuffer.set` would
  tombstone-and-append per tick until compaction forces
  whole-stream re-uploads, and every label write bumps the global
  `geoEpoch`, nuking the per-edge exact-bb memo.  Edge-label
  `anchorY` is fontSize-dependent (`-fontSize/2 + marginY`); node
  label anchors are not.
- Padding already cascades: `setCompoundStyle` marks the hierarchy
  geo-stale and the lazy flush re-derives auto-bounds.

**Design calls (round 25):**

1. **Geometry tweens never offload and are never stale.**  The
   round-9.4 tier rule stands: these channels are read by cull,
   CPU pick and the columnar scans, so every tick is a CPU column
   write (the mirror uploads dirty spans as usual).  Consequence,
   recorded as a contract point: unlike leased paint/position
   tweens, a geometry tween is always synchronously readable —
   `width()`/`bb()`/pick mid-tween report the mid-flight value
   (v3's behaviour).  `gpuEligible` stays false via the existing
   tier mechanism; the GPU tween kernels never see the new write
   kinds.
2. **The write vocabulary grows three CPU-only kinds.**
   `ChannelWrite` gains `lane` (scalar tween of one component of a
   multi-lane column — `node.size` lanes 0/1, `edge.arrowWidths`
   lanes, and the ×256 fixed-point stroke lanes of
   `edge.casing`/`edge.overlay`/`edge.underlay`), `padding`
   (writes `setCompoundStyle({ padding })` per tick), and
   `fontSize` (patches the label sidecar per tick).  Store entry
   points: `setLane` (with per-column cascade) and
   `setLabelFontSize`; both usable by the style engine too.
3. **The size-write cascade closes the label hole at the store;
   the CMPD bound needs nothing** (amended while building 25.1 —
   the investigation's "pinned-parent hole" did not survive a
   closer look).  `setPair('node.size')`/`setLane` re-anchor the
   label (`reanchorLabel` hoisted out of the parent-only path;
   early-outs when unlabelled or center-anchored).  The planned
   CMPD `invalidateRelation` hoist is **unnecessary by a
   containment argument**: the excursion bound is a max over both
   ends' stretches, stretch is monotone in `outerHalfW`, and
   auto-bounds derive parents from children's *outer* halves — so
   an ancestor's outerHalfW always dominates its descendants' and
   the max is always the ancestor's, which can only change when
   the ancestor's own box changes: exactly the event
   `materializeParentGeom` already invalidates on.  A
   descendant-size change that leaves the ancestor's box unmoved
   provably leaves the bound unmoved too.  (The same argument
   dissolves the investigation's monotone-safety worry: a stretch
   change implies a parent-box change implies a re-derive.)
   Pinned by a spec: a child size tween grows p2 through the
   parent's own materialization.
4. **Edge width carries its baked derivatives as ride-along lane
   writes**, the arrow-alpha-fold pattern: casing and
   overlay/underlay strokes ride additively (to = stored + Δwidth,
   only when the layer/casing is enabled), `arrowWidths` rides per
   mode (match-line → toWidth, percent → pct·toWidth, number →
   no ride), modes answered by the style engine at capture (the
   `captureArrowFold` precedent).  Transitions get the same rides
   from stored-truth diffing (the apply pass rewrites the derived
   channels; the txn records them as lane rides of `width`).
5. **Parent size is auto-bounds-owned: width/height tweens skip
   parent slots** (capture filters them; apply re-checks
   FLAG_PARENT per tick so a mid-tween leaf→parent flip drops the
   slot rather than fighting the derivation).  Recorded deviation:
   animating/transitioning `width`/`height` on a compound parent
   is a no-op — `padding`/min-size are the parent knobs, and the
   padding tween is this round's parent-size story.  Also
   recorded: `width` and `height` share the `node.size` channel,
   so the round-21 eviction treats them as one channel (a running
   width tween is evicted by a starting height tween).
6. **Padding tweens the declared value in its declared unit** (px
   or %-fraction; the resolution against the children bb happens
   at the flush, per tick, so relative modes follow live).  A
   unit change between sheets snaps (recorded).  Leaves have no
   padding — capture filters to parent slots.  The transition
   capture wraps the parents' `setCompoundStyle` apply (its own
   small capture beside the `write()` funnel, honouring the
   styled-generation instant-on-add rule).
7. **Font-size tweens re-break honestly, made affordable by four
   label-path fixes** (each useful beyond tweens): (a) a pure
   fontSize delta with unchanged breaking (wrap `none`, the
   default) scale-patches the stored dims instead of re-running
   `estimateBlock`; (b) the shaping-memo key drops `maxWidth`
   when wrap is `none` (kills the spurious per-tick miss +
   unbounded memo growth); (c) `GlyphBuffer.set` updates in place
   when the new run has the same glyph count (no tombstone
   growth, no forced compactions/whole-stream re-uploads under a
   steady tween); (d) label writes stop bumping the global
   `geoEpoch` (labels get their own epoch; the per-edge exact-bb
   memo keys on geometry alone).  Wrapped labels (`wrap`/
   `ellipsis` with a finite `maxWidth`) genuinely re-break per
   tick — correct, priced in the benchmark, and recorded as the
   expensive configuration.  The tween patches `fontSize` (and
   the fontSize-dependent `anchorY` on the three edge streams)
   across `nodes`/`edges` + end-label streams; min-zoomed-font
   culling follows automatically (the per-glyph threshold is
   rebuilt with the instances).
8. **Transitions wire through the same channels.**
   `TRANSITION_CHANNELS` gains nodes `width`/`height` (size
   lanes), `padding`, `font-size` and edges `width` (+ lane
   rides), `font-size`; the txn capture learns the lane/fontSize
   read-restore forms (the delay rule keeps holding pre-restyle
   values, sidecar included).  The round-24 "geometry snaps"
   specs flip to "geometry tweens" — the API surface is
   unchanged.
9. **Scale is measured, not assumed.**  A new
   `benchmark/gpu/geometry-tween.mjs` sweep prices: the size-tween
   tick at 2k/20k/200k animated nodes (labelled vs unlabelled —
   the re-anchor term), the edge-width tick with rides, the
   padding tick (auto-bounds flush per tick at compound scale),
   the font-size tick (wrap none vs wrapped — the re-break term),
   against the round-24 paint-tick baseline (15 ms/200k slots).
   The glyph-buffer in-place path is pinned by a
   no-growth/no-compaction assertion under a steady tween.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **25.1 The lane vocabulary + node width/height**
  (2026-08-02) — landed as planned, with design call 3 amended
  (above): the `lane` write kind (`ChannelWrite.lane`, stride 2,
  geometry-tier by construction — `TWEEN_SHADERS`/pipelines
  narrowed to a `GpuWriteKind` that excludes it, and the runtime
  throws if one ever reaches `register`), the store's cascading
  `setLane` (`node.size` routes through `setPair`; other float
  columns write the lane raw + dirty), the **label re-anchor
  hoist** into `setPair('node.size')` (the raw-size-write anchor
  staleness hole, closed for style writes and tween ticks alike),
  and `STYLE_CHANNELS` `width`/`height` as `node.size` lanes 0/1
  with parent slots filtered at capture and re-checked per tick
  (a mid-tween leaf→parent flip hands the slot to auto-bounds).
  No CMPD invalidation was added — the containment argument in
  call 3, pinned by the p2-growth spec.  Tests-first: 12 Node
  specs (`test/gpu-geometry-tween.mjs`, red then green) — width+
  height and width-only tweens, never-stale `width()`/`bb()`
  reads, outerHalf write-through, hanging-label re-anchor
  mid-tween, child tween drives parent auto-bounds per tick, the
  CMPD p2-growth pin, width-vs-height channel eviction, reverse
  continuity, spring clamp at the 0 floor, pause/resume.  2260
  Node tests, 63 module tests, typecheck + lint clean.
- [x] **25.2 Edge width + rides** (2026-08-02) — landed as
  planned: `STYLE_CHANNELS.width` gains the `edge.width` column
  (plain scalar, geometry tier) and the capture carries the three
  style-write-baked derivatives as ride-along lane writes
  (`captureEdgeWidthRides`, the `captureArrowFold` pattern): the
  casing/overlay/underlay strokes additively from stored truth
  (to = stored + Δwidth, per-slot gated on the layer record being
  enabled — mapper-resolved paddings/outline widths need no
  engine round trip), and `edge.arrowWidths` by mode via the new
  constants-only `StyleEngine.arrowWidthModes()` ('match-line' →
  target width, percent → pct × target, numbers stay).
  `setLane` encodes the layer records' ×256 fixed-point stroke
  lane.  Tests: 4 specs (red then green) — live `width()` reads,
  match-line + percent rides with stored-truth readback, the
  additive casing ride, ride-only-when-enabled (a disabled
  underlay's record never moves).  2264 Node tests, 63 module
  tests, typecheck + lint clean.
- [x] **25.3 Size transitions** (2026-08-02) — landed:
  `TRANSITION_CHANNELS` gains nodes `width`/`height` (`node.size`
  lane channels) and edges `width` with its baked derivatives as
  **lane rides** (casing/overlay/underlay stroke lanes ×256
  fixed-point, both `edge.arrowWidths` lanes — stored-truth
  diffing catches them because the apply pass rewrites them in
  the same funnel; rides move only when the width moved).  The
  txn machinery learned the `lane` kind end to end: descriptors
  (`TxnChannelDesc`, rides as full descriptors now), lane
  read/restore (restore runs the full size cascade, so the label
  the apply pass baked at the target re-anchors back to the held
  size), entries keyed `column:lane` (arrowWidths carries two),
  `buildChannelWrite` takes the lane through to the write.
  Parent slots never record a `node.size` transition (the
  auto-bounds rule, checked per slot in the diff).  The round-24
  "geometry snaps" spec flipped to "geometry tweens"; 5 new specs:
  sheet-swap both lanes with live bb, per-tick label re-anchor
  under a transition (held size restores the anchor too),
  edge-width rides (match-line + casing) with held pre-restyle
  values, a mapped width transition on a data write (scale move),
  and the parent-slot never-records pin (parent follows through
  auto-bounds only).  2269 Node tests, 63 module tests, typecheck
  + lint clean.
- [x] **25.4 Padding** (2026-08-02) — landed: the `padding` write
  kind targets the `node.padding` pseudo-column (`TweenColumn` =
  `ColumnId` + the pseudo target; padding is a compound style
  input, not a stored column) and writes through a new
  **`updateCompoundStyle`** — a partial merge over the *current*
  record, split from `setCompoundStyle` because a `{ padding }`
  tick must not reset the unit/min sizes while sheet writes keep
  their reset-what-you-omit semantics.  Parents-only mirrors the
  size rule (leaves filtered at capture, re-checked per tick);
  the declared value tweens in its declared unit (px, or the
  %-fraction — the auto-bounds flush resolves relative modes
  live).  The transition capture wraps the parents' compound
  write beside the channel funnel (`applyCompoundStyle`): styled
  marks read *before* the channel pass marks fresh slots
  (instant-on-add holds), diff + held-value restore as usual, and
  a px↔% unit flip snaps (recorded).  The GPU-kind narrowing
  extends to `padding` (`GpuWriteKind` excludes both geometry
  kinds; the runtime guard throws).  5 specs (red then green,
  minus the unit-flip snap which pinned the status quo):
  auto-bounds per tick via `paddedWidth()`, leaf no-op that still
  completes, %-fraction tween, the parents-sheet transition with
  held value, unit-flip snap.  2274 Node tests, 63 module tests,
  typecheck + lint clean.
- [x] **25.5 Font-size** (2026-08-02) — landed: the `fontSize`
  write kind (pseudo-columns `node.fontSize`/`edge.fontSize`) and
  `GraphStore.setLabelFontSize` — the per-tick sidecar patch, no
  engine round trip: an edge write drives all three streams and
  re-derives the fontSize-baked edge `anchorY` (−fs/2 + marginY);
  node anchors are size-derived and untouched.  Unlabelled
  elements filter at capture (animation) and snap via the −1
  sentinel (transition diff — a label added by a restyle has
  nothing to tween from).  The four label-path fixes shipped
  with it: the wrap-none scale-patch keeps dims **exact** (the
  round-16 wrap spec updated to pin the new contract — scaling a
  laid block is exact; a text change still re-estimates), the
  memo key drops `maxWidth` under wrap none, `GlyphBuffer.set`
  rewrites same-count replacements in place (pinned by a
  50-tick no-growth/no-tombstone spec with a single coalesced
  span), and label writes stop bumping `geoEpoch` (its only
  consumer is the edge curve-bb memo — no label terms).
  Tests: 3 animation specs (node dims/readback, edge anchorY +
  end-stream ride, unlabelled filter), 2 transition specs (held
  value tween, label-added snap), the glyph-buffer in-place
  spec, and the amended wrap-dims spec.  2280 Node tests, 63
  module tests, typecheck + lint clean.
- [x] **25.6 Benchmarks + browser specs** (2026-08-02) — landed:
  `benchmark/gpu/geometry-tween.mjs` (standalone, the
  transitions.mjs pattern) prices one manager tick per geometry
  channel at `BENCH_N` scale.  At 200k elements (headless,
  avg/iter, machine-local — the factors are the story): paint
  baseline 65 ms; node size 122 ms unlabelled / 136 ms with
  center-anchored labels (the re-anchor early-out is ~12%) /
  510 ms with hanging labels (a sidecar rewrite per tick — the
  25.5 dims fast path keeps the estimator out of the loop); edge
  width over 400k edges 86 ms bare / 130 ms with the full ride
  set; padding + auto-bounds flush 75 ms over 25k parents × 8
  children; font-size 213 ms wrap-none vs 767 ms wrapped (the
  honest re-break, the recorded expensive configuration).  Two
  `webgpu`-project Playwright specs: the sheet-swap width
  transition (pixels move mid-flight; `width()` reads the
  mid-flight value — the never-stale contract — and the hanging
  label's anchorX tracks −w/2 exactly, read atomically in one
  evaluate), and the edge-width casing ride (a fixed sample
  point passes white → black casing band → red line; the
  mid-state is *polled*, not slept for — suite load shifts the
  clock).  87/87 webgpu Playwright (2 new), run twice for
  stability.
- [x] **25.7 Closing docs sweep** (2026-08-02) — swept both docs
  for the round's vocabulary and staleness markers: the README
  header carries round 25, the follow-up hooks close the
  geometry-tween item (the parity remnants stay the open tail),
  the two-tiers bullet notes the round kept the geometry-stays-CPU
  rule, the round-16 label-cost line qualifies "never per frame"
  (per frame exactly under a wrapped font-size tween, recorded),
  and the gap ledger's two live sequencing references move past
  the round.  Full verification: typecheck, 2280 Node tests, 63
  module tests, lint, and 173/173 Playwright across the
  chromium + webgpu + webgpu-visual projects (goldens untouched;
  the webkit/webgpu-webkit projects could not launch on this
  box — `browserType.launch` fails on missing host system
  libraries, an environment gap needing sudo, not a regression;
  re-verify on a webkit-capable machine when convenient).
  **Round 25 is complete.**

## Round 26 plan — the authoring surface: JSDoc + shipped types (planned 2026-08-02)

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

- Public-member JSDoc coverage across `src/gpu` is **395/852 (46%)**
  (audit rule: members of exported classes whose names do not start
  with `_`).  The two files that *are* the public API are the worst
  covered: `collection.mts` 66/204 (32%) and `core.mts` 33/89 (37%).
  `animation.mts` is 33/48 (69%), `viewport.mts` 11/18, and the
  built-in layouts are 0/3 each.
- The comments that exist already **drift**:
  `GpuCollection.animate()` still advertises the pre-round-25
  animatable set (no width/height, edge width, padding or
  font-size).  A JSDoc pass is also a true-up pass.
- The docmaker target shape (`documentation/docmaker.json`) is
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
  contain zero gpu references, so `import cytoscapeGpu from
  'cytoscape/gpu'` resolves to untyped JS today.  Pointing the
  existing `rolldown.dts.config.mjs` at `src/gpu/index.mts` emits a
  complete 4,508-line / 191 KB declaration bundle in ~300 ms with
  no errors: the declarations are a config addition, not a project.

**Design calls (round 26):**

1. **JSDoc is the documentation source of truth for v4.**  Prose
   about what a member does lives next to the member, not in a
   parallel markdown tree.  `src/gpu/README.md` keeps its role —
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
4. **Declarations ship with the docs in them.**  `cytoscape/gpu`
   gains a real `.d.ts` built by the existing pipeline, so the
   JSDoc written in this round reaches consumers' editors as
   hover text.  This is the payoff that makes the comment pass
   immediately useful instead of only useful at release.
5. **Coverage is enforced, not aspirational.**  The audit becomes
   a checked-in script plus a Node test: the *public API tier*
   (the entry point, `GpuCore`, `GpuCollection`, the animation
   handle, the layout contract and the public style/option types)
   is gated at 100%, and the internal tier is reported with a
   floor that ratchets up as passes land.  Without a gate a
   46%-covered surface silently returns to 46%.

**Pass split** (docs in-commit; each pass its own commit(s)):

- [x] **26.1 The convention + the core surface** (2026-08-02) —
  landed as planned: `scripts/gpu-jsdoc-coverage.mjs` (the two-tier
  audit, `--verbose` for the per-member list),
  `test/gpu-jsdoc-coverage.mjs` (the completed-files ratchet + the
  tier floors), the conventions recorded in `src/gpu/README.md`
  ("Documenting the source"), and `core.mts` 33/89 → **89/89** plus
  `viewport.mts` 11/18 → **18/18**.  Two drift fixes found by
  writing the comments: `json()`'s doc block had become stranded
  above `serialize()` (so `json()` read as undocumented and
  `serialize()` carried the wrong prose), and the batching
  narrative was a bare `/* */` note rather than doc comments on
  `startBatch`/`endBatch`/`batch`.  Public tier 42.4% → **58.1%**;
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
  nothing about OKLab or the names-only easing rule.  Contract
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
  comment separated from its member by a later insertion.  The
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
  but reading, which is the argument for the coverage gate.  **Eight
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
  bodies → image/chart/overlay → labels.  A newcomer reading that
  header would have had the frame graph wrong.
  The audit gained overload handling: 26.5's `on`/`one`/`off`
  overloads made their implementation signatures read as
  undocumented members, and an implementation signature is not
  separately documentable — callers only ever see the overloads.
  Coverage gate tightened from a file allowlist to "no file has an
  undocumented public member", now that there is no partial file
  left.  Typecheck, 2285 Node tests, 63 module tests, lint clean.
- [x] **26.5 Shipped declarations for `cytoscape/gpu`**
  (2026-08-02) — landed: `rolldown.dts.gpu.config.mjs` rolls the
  prototype's declarations up (the existing pipeline, pointed at
  `src/gpu/index.mts`), `build-dts.mjs` gained `finalizeGpuDts`
  (the gpu entry is ESM-only — the `./gpu` export has no `require`
  condition — so no export-assignment reshaping is needed, only the
  UMD global name), `build:types` builds both entries, and the
  `./gpu` export gained its `types` key.  Two tests: the
  `test:types:gpu` shape audit (default export, the 37-name type
  surface with no leaks, the three factory statics — expando
  properties a declaration bundler is most likely to drop silently
  — and a floor on the JSDoc blocks reaching the shipped file) and
  `typescript/tests/gpu.test-d.ts`, a compile-only consumer test in
  the existing `test:types` project.
  **The comment pass pays off here**: 1089 JSDoc blocks reach
  `dist/cytoscape-gpu.d.ts`, so round 26's prose is hover text in a
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
  `formats` array.  Recorded, not fixed: `event.target` is
  `unknown`, because the event object is the shared v3 type and v3
  stays untouched until release; a v4-specific event type would be
  a design call, so consumers narrow it for now.
  Typecheck, lint, and the full `test:types:all` chain clean.
- [x] **26.6 Closing docs sweep** (2026-08-02) — swept both
  documents end to end.  Fixes: the README header now carries round
  26 and states the standing constraint that v3's code *and*
  `documentation/` stay untouched until v4 ships; the follow-up
  hooks gained a documentation entry that records what deliberately
  stays open (the docmaker generator and the release docs — neither
  built until v4 ships, since `documentation/` is v3's until then)
  plus 26.5's logged `event.target` call; the directory layout
  gained the round's seven new files, which belong to no single
  commit and are exactly what this sweep exists to catch; and
  `AGENTS.md` gained the convention itself under rule 8 — a
  contributor to `src/gpu/` now reads that v4 documents itself in
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
  `dist/cytoscape-gpu.d.ts` regenerated after the final 26.4
  comments: 6,840 lines, 1,091 JSDoc blocks.
  Full verification: typecheck, 2285 Node tests, 63 module tests,
  lint, the whole `test:types:all` chain (including the two new gpu
  audits), and 173/173 Playwright across chromium + webgpu +
  webgpu-visual (goldens untouched — the round changes no pixels;
  the webkit projects still cannot launch on this box, the same
  host-library environment gap recorded in round 25.7).
  **Round 26 is complete.**

## Observed once, unreproduced — a Node-suite flake (2026-08-02)

Logged so the breadcrumb is not lost, not because it is understood.

During the round-27 docs verification a single `npm run test:js` run
failed one spec; every other run that day passed.  What the output
showed: a chai `deepStrictEqual` on an array of element ids containing
at least `'1'` … `'8'`.  What is known:

- **Not reproduced in 37 subsequent full-suite runs**, nor in 60 runs
  of `test/gpu-algorithms-clustering.mjs` alone.
- The obvious suspect was **ruled out**.  `fuzzyCMeans` is the only
  clustering spec that passes `testMode: true` *without*
  `testCentroids`, so it falls through to `Math.random()` centroid
  initialization (`algorithms/k-clustering.mts` — the deterministic
  branch needs both).  Its spec is even named "random init".  But
  5,000 direct trials of exactly that fixture and options produced
  **0 mismatches**: the data is separated enough that random init
  always converges to the same partition.
- So the id array probably came from a different spec, and the run
  order or a shared global (the suite runs files concurrently) is the
  more likely direction than any one algorithm.

If it recurs, capture the failing spec name — that is the missing
piece.  Nothing here is a reason to distrust the round-27 results:
the same suite passed 37/37 afterwards, and every round-27 claim is
additionally pinned by browser specs and live parity diffs.

**It recurred once during round 41's verification (2026-08-04), and the
name was lost again — this time avoidably.**  One `npm run test:js`
reported `fail 1`; the diagnostic re-ran the suite instead of preserving
the failing run's output, and the re-run passed, so the spec name went
with it.  That is the second time this flake has been seen and the second
time nothing was learned from it, which makes the *method* the finding:
when a suite fails once, **keep that run's output** before doing anything
else.  A hunt of 20 consecutive full runs immediately afterwards
(captured to files, precisely so a hit would be readable) produced 0
failures, and ~28 clean runs surround the single failure.
The timing invites an obvious suspicion — it landed in the round that
replaced the emitter — and **it is not ruled out**, because without the
spec name nothing can be.  What can be said: the emitter swap was already
in the tree, 20 consecutive runs of that same tree passed, and the
phenomenon predates the swap by two days and one identical symptom
(`fail 1`, unreproducible).  That is evidence for "same flake", not
proof.  If a third sighting comes, the name settles it either way — which
is the whole reason to keep the output.

## Round 27 plan — the parity remnants (planned 2026-08-02)

The tail the README's follow-up hooks have carried since round 13:
compound arrow shapes, per-element numeric `text-rotation`, the
unported shape keywords, `border-style`/`outline-style`, and v3's
nonlinear arrow-size formula.  These are the last *visual* parity
gaps against v3 — everything else in the ledger is either landed,
dropped by decided design, or an open design call.  No new API is
invented here: every item is a v3 property or keyword whose
direction was set when its family landed.

**Code investigation (2026-08-02, precedes this plan):**

- **`edge.arrowShapes` is a full u32.**  Source shape at bits 0..7,
  target at 8..15, the two hollow flags at 16/17, mid-source at
  **18..20** and mid-target at **21..23** — three bits each, which
  ids 0..7 fill exactly — and the ×16 arrow scale in the top byte.
  Any new arrow id silently truncates for mid arrows.  But v3's
  whole arrow vocabulary is 12 shapes, so **four bits each is
  enough for all of them**: repacking to four 4-bit ids (0..15),
  the flags at 16/17 and the scale in the top byte fits in the same
  word with six bits spare and costs no extra memory.
- **The node shape field has room to spare.**  `borderGeom.y` packs
  borderPosition in bits 0..7 and the shape id in bits **16..19**
  — four bits, 15 of 16 ids used.  Bits 8..15 and 20..31 are free,
  so widening the shape field to a full byte (16..23) is a
  mask-and-shift change at five shader sites plus the pack site,
  and leaves room far beyond this round's twelve keywords.
- **Three of the twelve shape keywords are plain polygons** in v3
  (`right-rhomboid`, `concave-hexagon`, `cut-rectangle`): point
  tables that the existing SDF codegen, CPU pick and depth prepass
  pick up for free.  The seven `round-*` keywords are not — v3
  builds explicit per-corner arc geometry, and the naive
  "offset the polygon SDF by r" fails under anisotropic scaling,
  which is exactly why the README recorded them as deferred.
  `barrel` and the `triangle-backcurve` arrow both need a
  **quadratic-bezier SDF** — one primitive, two consumers.
- **`border-style` needs a perimeter parameter the node FS does not
  have.**  The edge shader dashes for free because it carries `u`
  (model px along the edge) as a varying; `nodeSD` returns a bare
  signed distance and discards the nearest-feature information a
  perimeter coordinate would be built from.  Closed form exists for
  circles and rectangles; polygons need the SDF loop to also track
  the argmin edge and its clamped projection.
- **`text-rotation` is one bit, not a value.**  The label sidecar
  stores `rotate: boolean`, packed as bit 31 of the glyph's owner
  word, and the angle is derived *live on the GPU* from the edge
  endpoints.  A numeric value needs a per-glyph `f32`, and
  `GLYPH_WORDS` is 14 with every word used.

**Design calls (round 27):**

1. **Repack before adding, both times.**  27.1 lands the two
   packing changes on their own, with no new keywords, so the
   existing suites and goldens prove the repack is a no-op.  Adding
   ids first would silently truncate — both packings are *lossy*,
   not loud, which is the argument for doing this as its own pass.
   The arrow word keeps its single-u32 footprint (four 4-bit ids);
   the shape field widens to a byte.  Recorded cap: 16 arrow
   shapes, which is v3's vocabulary plus four.
2. **v3's arrow-size formula, in model space.**  v4 sizes arrows
   `widthPx * 3 + 2` in *device* px off the LOD-floored width; v3
   uses `max( pow( width * 13.37, 0.9 ), 29 ) * scale` in *model*
   units.  Port the formula and evaluate it in model px before
   scaling by zoom, because v3's 29-unit floor is a model-space
   floor — evaluating it on the floored device width would make
   far-zoom arrows grow instead of shrink.  The quad extents and
   the store's `arrowScaleMax` slack meter must grow with it or
   arrows clip.
3. **Round corners get a real per-corner arc SDF**, not an offset
   hack.  Generated in the codegen beside the polygon tables, with
   the matching branch in `cpu-pick.insideShape`, so the two
   consumers agree by construction as they already do for
   polygons.  This is what unblocks all seven `round-*` keywords
   plus `bottom-round-rectangle` at one line each.
4. **One quadratic-bezier SDF, two consumers** — `barrel`'s four
   corner regions and the `triangle-backcurve` arrow.  Built once
   in 27.5 and consumed by 27.6, which is why the arrow pass comes
   after the shape pass rather than with the other arrows.
5. **Compound arrows are SDF unions**, `min( sdA, sdB )`, since
   coverage is a smoothstep over the distance.  Recorded
   deviation: `arrow-fill: hollow` on a compound shape falls back
   to filled — the stroke `abs( sd )` is wrong at the seam between
   the two parts, and v3 does not stroke compounds either.
   `triangle-cross` shifts with the edge width, which the FS
   already has as a varying, so its points are computed per
   fragment rather than read from a static table.
6. **Numeric `text-rotation` costs a glyph word.**  `GLYPH_WORDS`
   goes 14 → 16 (15 would break the 8-byte struct alignment) and
   the angle rides as an `f32`.  Node labels gain a rotation path
   they have never had, which forces two twins to follow: the
   glyph cull's rotated-rect AABB must read the stored angle
   instead of reconstructing the autorotate frame, and
   `cpu-pick.mts` must gain an OBB test — it currently *asserts*
   that node labels never rotate.  Recorded: node `boundingBox`
   label terms stay axis-aligned-conservative rather than exact.
7. **`border-style` gets the exact perimeter parameter, gated.**
   `u` is computed only in the dashed/dotted branch, so a solid
   border — the overwhelming default — pays a branch, not the
   extra work.  Closed form for circle/ellipse (angle-parameterized
   on the ellipse, whose arc length is elliptic; recorded as a
   deviation for eccentric ellipses) and rectangles; the polygon
   loop tracks the argmin edge and clamped projection against a
   per-fragment cumulative perimeter.  `double` is not a dash at
   all — a second inner band, no parameterization needed.
   `outline-style` reuses the same `u` at the ring radius, whose
   perimeter is offset and therefore a different length.
8. **Goldens are the proof.**  Every new keyword joins the existing
   per-shape golden grid, and each family gets a live v3 parity
   diff where v3 renders it correctly.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **27.1 The two repacks** (2026-08-02) — landed as planned.
  `edge.arrowShapes` now carries four 4-bit ids (source, target,
  mid-source, mid-target), the two hollow flags at 16/17 and the
  ×16 scale in the top byte, with six bits spare — the same single
  u32, so no column grew.  The layout lives in `contract.mts`
  behind `packArrowShapes`/`unpackArrowShape` and named shift
  constants, which the two arrow shaders **interpolate into their
  WGSL** rather than restating: one source of truth for a packing
  that four readers share.  `packArrowShapes` throws on an id that
  does not fit, so the next person to add an arrow gets an error
  instead of the silent mid-arrow truncation this pass existed to
  remove.  The node shape field widened from a nibble to a byte
  (`SHAPE_SHIFT`/`SHAPE_MASK`, five shader sites plus the pack
  site), and `setBorderGeom` throws past the field width too; its
  hardcoded `shapeId === 14` became `SHAPE_POLYGON_CUSTOM`.
  Tests-first: the three existing specs that pin the bit layout
  were rewritten to the new one (red), then the code moved (green),
  and `test/gpu-packing.mjs` adds 8 specs — every id round-trips in
  all four arrow positions, the positions stay independent, the
  flags and scale byte stay clear of the ids, over-wide ids throw,
  a real mid-arrow restyle survives, and the shape field's margin
  over the enum is asserted rather than assumed.
  The pass changes no pixels, and that is the point: 2293 Node
  tests, 63 module tests, typecheck, lint, 87/87 webgpu and
  **68/68 webgpu-visual with the goldens untouched**.
  *Correction, made while landing 27.2*: that browser verification
  was first run against a **stale bundle** and re-run afterwards
  before it meant anything.  `playwright.config.js` sets
  `reuseExistingServer: !CI`, so with an `http-server` already
  listening on 3333 Playwright attaches to it and the
  `test:playwright:build` half of `test:playwright:setup` never
  runs — the suite exercises whatever was built last, and a green
  run proves nothing about the change under test.  Re-run against a
  freshly built bundle (with 27.2 in as well), the 68 pre-existing
  goldens are still byte-identical, so the repack *is* the visual
  no-op claimed — but the first run had not shown it.  The trap is
  now recorded in `AGENTS.md`'s testing notes, since its only
  symptom is a pass you did not earn.
- [x] **27.2 The three unported shape keywords** (2026-08-02) —
  landed, with the plan's own framing corrected: only **two** of
  the three are plain polygons.  `right-rhomboid` and
  `concave-hexagon` are v3 point tables, so they are entries in
  `POLYGON_POINTS` and nothing else — the SDF codegen, the CPU
  pick and the depth prepass pick them up with no per-shape code,
  which is the payoff of the round-10 table design.
  `cut-rectangle` is **not** a unit polygon: v3 chamfers by an
  *absolute* length (`getCutRectangleCornerLength()` = 8 model px,
  or the element's `corner-radius`), so a unit table would make the
  chamfer scale with the node, which is exactly what v3 does not
  do.  It gets its own SDF — the box intersected with the diagonal
  half-plane `|x| + |y| <= hw + hh - c`, whose max of two exact
  convex fields is itself exact — plus a matching `cpu-pick`
  branch.  Its `'auto'` resolves to a flat 8 px where
  round-rectangle's is `min(w/4, h/4, 8)`: **one prop, two
  defaults**, as in v3, so the shader gained `cornerLengthPx` over
  `cornerRadiusPx` and every one of the five call sites now passes
  the shape.  Tests-first: 11 Node specs (red then green) covering
  compile/store/readback per keyword, both v3 point tables
  verbatim, the fact that `cut-rectangle` is deliberately absent
  from `POLYGON_POINTS`, the explicit-radius path, and that an
  unported keyword still throws.  A `shapes-27` golden shows all
  three, with `cut-rectangle` at three sizes under `'auto'` — the
  24px node is what makes the golden discriminate between the two
  auto rules, since at 60px they coincide at 8.
  2304 Node tests, 63 module tests, typecheck, lint, 87/87 webgpu
  and 69/69 webgpu-visual (68 unchanged goldens + the new one),
  all against a freshly built bundle.
- [x] **27.3 v3's nonlinear arrow-size formula** (2026-08-02) —
  landed.  v4 sized arrows `widthPx * 3 + 2` off the LOD-floored
  *device* width; v3 uses
  `max( pow( width * 13.37, 0.9 ), 29 ) * scale` in *model* units.
  The formula now lives in `arrowSizePx` in both arrow shaders and
  is evaluated in model space before the zoom scale, because v3's
  29-unit floor is a model floor — applying it to a floored device
  width would make arrows *grow* as you zoom out.
  Two things had to be got right that the plan did not anticipate:
  the exact arrow scale lives in the packed shapes word, which is a
  **fragment-visible** binding, so a first attempt that read it in
  the vertex stage produced pipeline-validation errors on every
  arrow pipeline; the varying now carries the model width and the
  fragment stage resolves the size (which is also what 27.6's
  edge-width-dependent `triangle-cross` will need).  And v3's
  `size` is the **point-table scale, not the drawn length** — its
  transform scales the ±0.15 / −0.3 table by `size` directly, so
  the arrow is 0.3 × size long.  v4's old code folded that 0.3 into
  its own constant, and porting the formula without unfolding it
  made arrows 3.3× too long.
  **The parity diff is what caught both.**  A new live v3-vs-v4
  arrow-sizing test renders three edge widths spanning the
  formula's floor (1 and 2, where the 29 floor dominates; 6, where
  the pow term has taken over).  The measured arrow extents now
  match v3's **exactly** in all three regimes, and the whole-scene
  mismatch went 4.459% → **0.013%** (16 px of pure anti-aliasing).
  Recorded: the 0.5% golden tolerance was loose enough that the
  arrow goldens *passed* both before and after the change, so the
  goldens alone would never have caught the old deviation — the
  parity diff is the load-bearing check for anything claiming to
  match v3.  Eight arrow-scene goldens regenerated (the intended
  visual change); eight label-only goldens that also drifted were
  **reverted**, since their scenes contain no arrows and the drift
  predates this pass — a sub-tolerance glyph-AA wobble worth
  noticing but not this pass's to absorb.
  2304 Node tests, 63 module tests, typecheck, lint, 87/87 webgpu,
  70/70 webgpu-visual.
- [x] **27.4 The round-corner SDF** (2026-08-02) — landed, and
  with a better primitive than the plan called for.  The plan
  proposed porting v3's per-corner arc construction; the identity
  that makes it unnecessary is that **a polygon with every corner
  replaced by a tangent arc of radius r is exactly the Minkowski
  sum of the inward-offset polygon with a disc of radius r**.  So
  the field is `sdPolygon( offset ) - r`, with the offset vertices
  in the standard miter form
  `o = v + r · (n1 + n2) / (1 + n1·n2)` — and that is exact under
  anisotropic scaling, which is the precise reason round 13
  deferred the family ("corner-rounding an anisotropically scaled
  polygon has no clean closed form" — the README's recorded
  deviation, now closed).  Winding is folded in at codegen from the
  signed area, so the shader does no orientation test, and the
  seven keywords reuse their sharp counterparts' point tables
  exactly as v3 registers them (`ROUND_POLYGON_SOURCE`), so the
  family costs one shared generated SDF rather than seven tables.
  `bottom-round-rectangle` rides the round-rectangle field with the
  radius selected by the sign of `p.y`.  `cpu-pick` gained the
  matching `insideRoundPolygon` — note it is *not* affine-invariant
  the way the sharp polygons are, so unlike them it must test in
  device space.  The round family's `'auto'` is v3's
  `getRoundPolygonRadius` = `min(w/10, h/10, 8)`: a **third**
  meaning for `corner-radius`, after round-rectangle's
  `min(w/4, h/4, 8)` and cut-rectangle's flat 8 — all three are
  v3's, not v4 inventions.
  **The parity diff is the proof**: a live v3-vs-v4 scene of all
  seven keywords plus a deliberately stretched node differs by
  **58 px (0.048%)**, pure arc anti-aliasing.  A control run with
  v4 drawing the *sharp* shapes against v3's round ones was checked
  first, to confirm the test discriminates at all, and the scene
  uses a generous 14px radius for the same reason — at v3's 'auto'
  the rounded and sharp outlines differ by only ~180px, which would
  have made a clean result far less meaningful.  A
  `shapes-27-round` golden covers the family plus the anisotropic
  case.  17 Node specs; 2311 Node tests, 63 module tests,
  typecheck, lint, 87/87 webgpu, 72/72 webgpu-visual.
- [x] **27.5 `barrel`** (2026-08-02) — landed, and the plan's
  premise turned out to be wrong in a useful way.  It called for an
  exact quadratic-bezier SDF (a cubic solve) shared with
  `triangle-backcurve`.  But **v3 itself approximates**: its barrel
  hit test samples each corner's curve at t = 0.15/0.5/0.85 and runs
  a polygon test.  So v4 rebuilds the outline per fragment — four
  bezier corners sampled into `BARREL_CURVE_SEGMENTS` = 4 segments,
  the same fidelity v3's own hit test uses — and runs the standard
  exact-polygon distance loop over the result.  Sign and distance
  are exact *for that outline*; the only approximation is the
  outline itself.
  Barrel's offsets are size-relative until they hit v3's absolute
  caps (height 15, width 100), so like `cut-rectangle` it is a
  parameterized shape rather than a unit table, and `nodeSD` gained
  a `zoomDpr` argument to resolve them.  `cpu-pick` gained
  `insideBarrel`, built from the same constants.
  **Whether the sampling is good enough was measured, not
  asserted**: v3 draws the real `quadraticCurveTo`, so the parity
  diff is the answer — four sizes spanning the capped and uncapped
  regimes differ by **14 px (0.012%)**.  At v3's corner offsets the
  sampled and exact curves are indistinguishable, so the exact
  bezier SDF was not built.  27.6 will decide `triangle-backcurve`
  on its own evidence rather than inheriting the assumption.
  **This completes v3's node-shape vocabulary.**  A pre-existing
  spec that used `'barrel'` as its example of an unsupported
  keyword had to be changed to name something that is not a shape
  at all — there is no unported v3 node shape left.
- [x] **27.6 Compound arrow shapes** (2026-08-02) — landed, built
  three different ways.  `triangle-tee` is a union of two generated
  polygons (`min( sdA, sdB )` — coverage is a smoothstep over the
  distance, so a union needs no stitching); `circle-triangle` is a
  polygon plus an analytic disc; `triangle-cross`'s bar tracks the
  **edge width** rather than the arrow size, so it is computed per
  fragment from the model-width varying 27.3 introduced — the
  reason that varying carries the width instead of the finished
  size.  And `triangle-backcurve` needed **no new machinery at
  all**: 27.5 established that sampling a quadratic at codegen is
  indistinguishable from solving it, so its curve is baked into an
  ordinary point table and it rides the existing generator.  The
  exact bezier SDF the plan reserved for it was never needed.
  **Two real bugs surfaced from the parity diff, not from the
  suites.**  The first measurement came back at 0.141% — passing,
  but an order of magnitude worse than 27.4's and 27.5's, which is
  what prompted a per-head breakdown rather than acceptance.
  (a) The arrow quad's extent was hardcoded to the plain triangle's
  0.3 reach, so `triangle-tee` (0.5) and `circle-triangle` (0.6)
  drew **clipped**.  `ARROW_MAX_BACK` is now *computed* from the
  tables, so adding a head cannot silently clip it again, and
  `triangle-cross`'s bar adds the edge width on top.  (b) v3 pulls
  `circle-triangle` back by its circle radius (the shape's
  `spacing` — the only head v3 offsets at all) so the *disc* meets
  the node boundary rather than the disc's centre; that shift is
  baked into the points and the disc centre, so it costs no runtime
  logic.  After both: **44 px (0.037%)**, in line with the round's
  other heads.
  Recorded deviation: `arrow-fill: hollow` on a compound head falls
  back to filled — the stroke `abs( sd )` is wrong at the seam
  where a union's parts meet, and v3 does not stroke compounds
  either.
  **This completes v3's arrow vocabulary**, and as with 27.5's
  shapes a pre-existing spec had to stop using a real keyword
  (`'triangle-backcurve'`) as its example of an unsupported one.
  2315 Node tests, 63 module tests, typecheck, lint, 87/87 webgpu,
  74/74 webgpu-visual.
- [x] **27.7 Numeric `text-rotation`** (2026-08-02) — landed.
  Rotation was one bit — `autorotate`, edge labels only, the angle
  derived live on-GPU from the edge's slope.  v3 also takes a plain
  number of radians, on any label.
  **The encoding is the interesting call.**  The stored value is the
  angle in radians with **`NaN` meaning autorotate**.  That works
  because `'none'` and a rotation of 0 radians are the *same
  rendering*, so collapsing them costs nothing — and it leaves the
  whole real line free for numeric values, where an enum id would
  have collided outright: autorotate's id was `1`, and 1 radian is
  a perfectly ordinary rotation (pinned by a spec).
  `GLYPH_WORDS` went 14 → 16.  15 would hold the data but breaks the
  struct's 8-byte alignment, and the alternative — a per-owner
  storage buffer — was rejected because the edge label pipeline is
  already at 7 storage buffers against a base limit of 8.  Recorded
  cost: 64 bytes per glyph instead of 56, ~14% on the heaviest
  stream.
  Node labels gained a rotation path they never had (the VS now
  takes one branch for both modes), the glyph cull computes the
  exact rotated-rect AABB from the stored angle on both the node
  and edge streams, and `cpu-pick` gained an **OBB** test — it
  previously asserted in a comment that node labels never rotate,
  which stopped being true here.  `autorotate` stays edge-only and
  now says so in its error message.
  **The parity test had to be rebuilt to mean anything.**  The first
  version — four modest labels at small angles — passed at 0.514%,
  and then passed at 0.672% with v4 **ignoring rotation entirely**.
  A test that cannot fail is not evidence.  The scene is now
  ink-dominated (40px text, ±90°/±45°): 2.3% with rotation honoured
  against **5.8% for the same control, which fails the bound**.
  The floor is glyph rasterization, not placement — canvas vs SDF —
  which is why this one bound is 3% where the shape diffs sit near
  0.05%.  13 Node specs; 2328 Node tests, 63 module tests,
  typecheck, lint, 87/87 webgpu, 75/75 webgpu-visual.
- [ ] **27.8 `border-style` / `outline-style`** — **stopped for a
  scope call** (2026-08-02), not for a technical blocker.
  The technique is settled.  `double` is not a dash at all — a
  second inner band, no parameterization needed, and it works on
  every shape.  For `dashed`/`dotted` the existing `dashInsideSd`
  machinery is reusable verbatim; the only missing ingredient is a
  **perimeter coordinate** in the node fragment shader, which comes
  in three tiers of cost:
  - *closed form, cheap*: circle (exact — `θ·r`), rectangle and
    round-rectangle (walk the sides plus corner arcs, ~30 lines);
  - *closed form, approximate*: ellipse, whose arc length is an
    elliptic integral — angle-parameterizing it makes dashes
    unevenly spaced on eccentric ellipses, a recordable deviation;
  - *real work*: the polygon family (the round-* shapes, `barrel`
    and the custom `polygon` included), where the SDF loop must also
    track the argmin edge and its clamped projection against a
    per-fragment cumulative perimeter — roughly doubling the polygon
    fragment cost wherever a dash is enabled.
  The 2026-07-28 gap ledger flagged this family as **"needs a scope
  call on which subset earns its shader/channel cost"**, and that
  call is still open: shipping `dashed`/`dotted` on
  circle/rect/round-rect only is a genuine v3 deviation (v3 dashes
  any shape), while covering every shape is the round's largest
  single piece of shader work for a property with no other consumer.
  Deciding that unilaterally would be improvising API scope, so it
  waits.  Everything else in round 27 landed.
- [x] **27.9 Verification** (2026-08-02) — the golden grids and
  parity diffs landed with their own passes rather than in a
  trailing sweep, which is why each was able to *change the code*:
  27.3's diff caught two wrong ports of v3's arrow formula, 27.6's
  caught a clipped arrow quad and a missing offset, and 27.7's first
  version was rebuilt after a control showed it passed with the
  feature disabled.  Five new live parity tests in total (arrow
  sizing, the round family, barrel, compound arrowheads, text
  rotation), two new goldens, and three golden grids extended.
  Costs: `benchmark/gpu/labels.mjs` re-run at 100k — breakLines
  3.8 µs, estimateBlock 4.6 µs, setLabel build 5.1 µs, the
  whole-graph bb's label terms 0.11 µs — all matching the round-16
  baselines, so 27.7's wider glyph instance costs nothing on the
  CPU side.  Its device-side cost is arithmetic and recorded: 64
  bytes per glyph instead of 56.
  **Not measured here**: the device-side frame cost of the new
  shader branches.
  *Correction (2026-08-03)*: the reason given for that was **wrong**.
  This record said `benchmark:gpu:renderer` "requires a real adapter
  and this box has only SwiftShader" — the box has an **AMD RX 580**
  (RADV POLARIS10, alongside an Intel UHD 630), which is the same
  hardware the 2026-08-01 validation pass benchmarked on, and the
  benchmark harness does get the hardware adapter.  Only the *golden*
  project pins SwiftShader, deliberately, and only for the WebGPU
  adapter.  This is the second time that conclusion has been reached
  and corrected: the 18.5 note claiming a software-only adapter was
  corrected by the same hardware pass, which traced it to
  `requestAdapter()` returning null on `about:blank` — probe from a
  served page.  The measurement was therefore *skipped*, not blocked.
  **Answered by round 29.5** (2026-08-03): re-run on the RX 580
  against the pre-round-27 baseline, every stable device row moved
  +0.3% to +3.6% — the label rows at the top of that band, consistent
  with 27.7's wider glyph instance, and the shape and arrow branches
  invisible.  Round 27 cost nothing measurable per frame.
- [x] **27.10 Closing docs sweep** (2026-08-02) — swept both
  documents for the round's vocabulary.  The README header carries
  round 27; the node-shape section now records the completed
  vocabulary, the three parameterized shapes, and the fact that one
  `corner-radius` prop carries **three** different 'auto' rules (all
  v3's); the arrowhead section records the compound heads, how each
  is built, the hollow-fallback deviation, and v3's sizing formula
  with its model-space caveat; the label section records numeric
  `text-rotation` and its glyph-memory cost; and the border-geometry
  note now explains *why* `border-style` is unported (the missing
  perimeter coordinate) instead of just asserting it.
  Corrected while sweeping: the shape section still said the
  `round-*` family had "no clean closed form" under anisotropic
  scaling — 27.4 found one, so leaving that note in place would have
  discouraged exactly the work that closed it.  The follow-up hooks
  now list `border-style`/`outline-style` as the single remaining
  parity item, waiting on a scope call rather than on a technique.
  **Amended after a second pass (2026-08-02)**: this sweep did the
  README end to end and stopped there, leaving *this file's* gap
  ledger still asserting that the shape keywords, the compound
  arrow shapes and numeric `text-rotation` were unbuilt — three
  things the round had just built — and the "Suggested sequencing"
  summary still listing them as remaining.  Items 4, 5 and 6 of the
  needs-a-call ledger and the sequencing paragraph are now true up;
  the directory layout picked up round 27's changes to
  `shape-points.mts` and `contract.mts`; the README's JSDoc-coverage
  paragraph still described round 26.1's file-allowlist gate rather
  than the 100%-everywhere rule 26.4 replaced it with; and both
  documents now record the round's most transferable finding — that
  a golden answers "did this change?" while only a parity diff
  answers "is this right?", and that a parity test should be run
  once with its feature disabled to prove it can fail.  The standing
  process rule above gained "sweep this file too".
  A read-the-code verification pass over the README's factual
  claims (13 checked against source, most confirmed) turned up three
  that were wrong, all now fixed: the curved-edge section recorded a
  **deviation that does not exist** — it said v3 staggers an
  `unbundled-bezier` without `control-point-distances` by the
  unbundled pair group and that v4 does not port it, when v3's
  `edgeIsUnbundled` branch assigns the plain step size and its
  staggered `normctrlptDist` is dead on that path, so the two agree;
  the event section said `event.preventDefault()` "stays unported"
  with `originalEvent` keeping the DOM method, when in fact the
  method **is** present (v4 emits the shared v3 `Event`) and
  silently does nothing because no v4 code reads
  `isDefaultPrevented`, while `originalEvent` is never populated at
  all — the old wording told a reader to reach for a route that is
  not there; and "round 26 took both tiers from 46%" conflated a
  combined figure with per-tier ones (43% public, 55% internal).
  Two more findings from the second pass, both outside the docs
  themselves: the **debug harness** (`debug/webgpu/init.js`) carried
  allowlists that silently dropped any shape outside
  ellipse/rect/round-rect and any arrowhead but triangle when
  converting a v3 fixture stylesheet — stale since round 10, and
  now inverted into a much shorter list of the v3 spellings v4 does
  *not* accept.  And that shorter list exposed a small
  **inconsistency worth a call rather than a silent patch**: the
  2026-07-29 triage dropped the no-dash legacy aliases, yet
  `roundrectangle` is still accepted while `cutrectangle` and
  `concavehexagon` are not.  Recorded in the README next to the
  shape vocabulary.
  **Round 27 is complete apart from 27.8, which is held for that
  call.**

## Round 28 plan — the no-call remainder (planned 2026-08-03)

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
`test/gpu-cpu-pick.mjs` — the harness that actually drives the pick
path against the store — stops at round 10's polygon family.

Three specs in `test/gpu-shapes-27.mjs` are *named* for picking and
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
(27.9).  That one was recorded as blocked on hardware, which was
**wrong** — this box has an AMD RX 580, the same device the 2026-08-01
hardware validation pass benchmarked on, and `benchmark:gpu:renderer`
reaches it.  It is a measurement nobody has run, not one that cannot be
run here; see the correction in the 27.9 entry.

**Pass split** (tests-first; docs in-commit; each pass its own
commit(s)):

- [x] **28.1 CPU-pick coverage for the round-27 shapes** (2026-08-03) —
  landed, and the controls are the part worth recording: **two of the
  five new specs did not discriminate on their first version**, which
  is the same defect the pass exists to fix, caught this time because
  the control was run before the commit rather than after.
  The specs live in two places by design.  `test/gpu-shapes-27.mjs`
  gets the keyword-level ones, which run the whole public path — the
  sheet compiles, the style engine writes `borderGeom`, `pickNodeAt`
  reads the stored words — and each case is chosen to be a *hit* for
  `rectangle` (or, for the round family, for the sharp counterpart),
  with that control asserted inline in the same spec.  `cy.pick()`
  itself resolves null on a headless instance, so these call the pick
  path directly; that is what the three replaced specs had backed away
  from into `boundingBox()` assertions.
  `test/gpu-cpu-pick.mjs` gets the branch-level properties, aimed at
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
  cap would give.  Controls run, each by patching `cpu-pick.mts` and
  re-running: cut-rectangle → plain rectangle (3 specs fail), barrel →
  plain rectangle (2 fail), round-* → the sharp polygon test (2 fail),
  and the radius cap left unscaled by zoom (1 fails — the one written
  for it, and nothing else, which is what a targeted spec should do).
  7 new specs; 2335 Node tests, 63 module tests, typecheck, lint.
  No source changed, so the browser suites are unaffected.
- [x] **28.2 `cy.animate({ panBy })`** (2026-08-03) — landed as
  planned, in `_resolveViewportTargets` beside `fit`/`center`: the
  delta resolves against the pan **at creation**, which is v3's own
  rule (`define/animation.mts` normalizes `panBy` against `cy.pan()`
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
  Tests-first: 5 specs in `test/gpu-viewport-animation.mjs` (the
  delta; creation-time resolution, pinned by panning away before
  `play()`; the `panningEnabled` gate; the throw; and `fit` winning
  over `panBy`), 4 red before the change.  2340 Node tests, 63 module
  tests, typecheck, lint, JSDoc coverage 100%.  `AnimateOptions` is
  public surface, so `dist/cytoscape-gpu.d.ts` is regenerated and
  `npm run test:types:gpu` re-run; `dist/cytoscape.d.ts` (v3) is
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
  describes.  The README carries round 28 in its header, records
  `panBy` in the viewport-targets bullet with the pan/panBy deviation,
  records the round-27 shapes' CPU-pick twins in the shape section,
  and its follow-up hooks now list only open design calls.
  Verification for the round as a whole: 2340 Node tests, 63 module
  tests, typecheck, lint, JSDoc coverage 100%, `test:types:gpu` with
  the regenerated declarations.  The browser suites were not re-run
  for 28.1 or 28.3 (tests and docs only); 28.2 touches the viewport
  animation path, whose coverage is the Node suite.
  **Round 28 is complete.**

## Round 29 plan — test + benchmark hardening (planned 2026-08-03)

Round 28 closed the ledger's no-call remainder.  This round comes from
a different question — *not* "what is unbuilt" but "what is unpinned":
a survey of `src/gpu` (49k lines; 121 Node spec files and 14 benchmark
suites at the time — 123 and 15 after this round) for behaviour that
exists, is documented, and is measured or asserted by nothing.

**Survey method and what it ruled out**, since the negative results are
worth as much as the findings:

- **Module-level coverage is not the gap.**  Mapping every `src/gpu`
  module to test files that import it shows ~50 with no direct
  importer, but almost all of those (the algorithms, the layouts,
  `core`/`collection` themselves) are exercised through the public
  entry point, which is the right way round.  Nothing was added on
  this basis.
- **The round-27 vacuous-spec defect looks isolated.**  A scan of all
  121 gpu spec files for specs that assert nothing, or whose name
  promises a behaviour their body never invokes, produced 64 hits and
  **no new real ones** — the `NO EXPECT` hits are helper-wrapped
  assertions (`close()` in `gpu-curve-geometry.mjs`, the `throws()`
  helpers in `gpu-mappers.mjs`) and the rest are false matches on
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
   `GpuCollection.prototype.each = GpuCollection.prototype.forEach`
   line.  Deleting a wiring line leaves the typecheck green — the
   `declare` keeps asserting the method exists — and breaks the alias
   at runtime with nothing to catch it.  All 83 are consistent today
   (verified by parsing both sources); the point is that nothing keeps
   them that way.  Untested ones include `centre`, `deselect`, `each`'s
   siblings `point`/`points`/`modelPosition`/`modelPositions`,
   `renderedCss`, `renderedBoundingbox`, `jpeg`, `invalidateSize`, the
   British spellings (`allAreNeighbours`, `degreeCentralityNormalised`,
   `closenessCentralityNormalised`) and four algorithm aliases.
2. **Four public methods have zero mentions anywhere in the suite**:
   `silentPositions`, `silentShift`, `delayAnimation` and
   `renderedOuterHeight` — the last a plain sibling gap, since
   `renderedOuterWidth` is tested one line away in
   `gpu-collection-dimensions.mjs`.
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
  `test/gpu-aliases.mjs`: 83 identity checks (the alias exists, is a
  function, and is `===` its target on the prototype), 6 that reach the
  aliases through a live instance (a class field or own property could
  in principle shadow the prototype, which the identity check alone
  would not see), and 2 that cross-check the table against the sources
  in both directions.  All 83 were already consistent — the pass adds
  no fix, it adds the thing that notices.
  Controls: deleting the `each` wiring line fails 2 specs (the identity
  check and the instance check), and declaring an alias that the table
  does not list fails the source cross-check.  Both were run.
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
  and `renderedOuterHeight` in `gpu-collection-dimensions.mjs`,
  `delayAnimation` in `gpu-animation.mjs`.  The silent specs assert the
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
  `test/gpu-decided-drops.mjs` then pins the ledger: selector strings
  at every entry point, the absent class methods and `cy.$`, the
  sheet's rejection of `z-index` and the 2026-07-29 triage drops, the
  no-dash shape spellings (with `roundrectangle`'s survival pinned
  *as* the recorded inconsistency, so the line has to change when the
  call is taken), the bypass setter, `json(obj)`, custom easing
  functions, and `queue`/`step`.  16 specs, each citing the ledger
  entry it pins.
  Verification: 2453 Node tests, 63 module tests, typecheck, lint,
  JSDoc 100%, and — because this pass changes source — **87/87 webgpu
  and 75/75 webgpu-visual against a freshly built bundle** (an
  http-server was already listening on 3333, which is exactly the
  stale-bundle trap, so the build was run by hand first).
  *(Original plan text below.)*

  **29.3 Decided drops stay dropped.**  A spec file pinning the
  design ledger's rejections at the API boundary: selector strings on
  every query entry point, `cy.$`, classes, `z-index` in a sheet, and
  the per-element bypass setter.  Each assertion cites the ledger entry
  it pins.
- [x] **29.4 A curved-edge CPU benchmark** (2026-08-03) — landed as
  `benchmark/gpu/curves.mjs`, standalone and gpu-only like
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

  **29.4 A curved-edge CPU benchmark** (`benchmark/gpu/curves.mjs`),
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
  every stable row moved **+0.3% to +3.6%**, most under +2%.  The
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
in `src/gpu` was mapped against V8 coverage of the Node suite.  The
first attempt read raw `NODE_V8_COVERAGE` offsets against the `.mts`
sources and reported 47 dead sites — *including* `arrow-scale must be
positive` and `not a valid font-family`, both of which have had throw
specs since round 13.  tsx transpiles before V8 sees the file, so those
offsets belong to the transpiled text and the mapping was fiction.  The
measurement that stands runs the suite under
`--enable-source-maps --experimental-test-coverage --test-reporter=lcov`
and reads source-mapped `DA:` line counts; it puts the two known-tested
sites back in the covered column, which is the check that makes the
rest believable.

**Finding: 191 throw sites in `src/gpu`, 34 never executed** by the
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
  measurement moved **34 never-executed throw sites → 14**.  Every one
  of the 14 that remain is browser-only (`renderer.mts`'s five export
  guards, `gpu-context`, `column-mirror`, `glyph-atlas`, `gpu-tween`,
  `image-decoder`) or unreachable by design (the SHAPE_MASK field
  invariant; the big-endian platform guard).
  *(Read 15, not 14, from 30.4 onward: `renderer.mts` has a **sixth**
  export guard — `exportScale`'s — which the raw line data reported as
  covered because it sits in a module-level arrow const.  30.4's
  calibration found it and moved it into the browser tier, which is why
  30.2 pins six guards where this entry counts five.)  **Every Node-reachable
  throw in `src/gpu` now runs in the Node suite.**
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
  keep.  `cytoscapeGpu({ container: {} })` throws with the factory's
  own `navigator.gpu` check deleted, because the renderer attach path
  25 lines below carries an identical check with an identical message.
  The two are not redundant — the early one is a fail-fast *before*
  `new GpuCore`, element ingest and the ctor `layout` run — so the
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
  in the `webgpu` project covering all **six** throws of the export
  path (the plan said five; `exportScale`'s own guard is a sixth, in a
  module-level helper rather than in `computeExportView`).  These are
  public contract — `bg` and `scale` come straight from the caller, and
  the other four are states a real app reaches: an empty graph, a
  `display: none` container, a figure scaled past the device's texture
  limit, and a destroyed renderer.
  Each spec asserts the **message**, not just the rejection, because
  four of the six live in one method and a bare rejection would not say
  which fired.  Two carry a control in the same spec that separates the
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
  **`cy.stop()`** (3 specs, `gpu-viewport-animation.mjs`): `ani.stop()`
  and `ele.stop()` were tested and the core sibling was called by
  nothing.  Both arms are pinned, since the difference between them is
  the whole point of the argument — the default freezes the viewport
  where the tween reached and it stays there, `stop( true )` applies
  the targets — plus the promise resolving and the idle call being a
  no-op.  One drafting note: the first `viewport` emit can land at
  t = 0, so the specs wait for actual movement rather than for the
  event.
  **`renderedTargetEndpoint`** (1 spec, `gpu-curve-12c-accessors.mjs`):
  29.2's `renderedOuterHeight` shape exactly — the source twin has been
  tested since 12c.  The spec asserts the transform *and* that the
  answer is the target end, which is what a copy-paste from the
  sibling would break.
  **The clustering metrics** (5 specs, `gpu-algorithms-clustering.mjs`):
  every existing clustering spec passes `euclidean`, `manhattan` or a
  custom function, so `squaredEuclidean` and `max` — public option
  values — ran nowhere.  The specs assert the arithmetic through the
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
- [x] **30.4 `scripts/gpu-throw-coverage.mjs`** (2026-08-03) — landed,
  mirroring `scripts/gpu-jsdoc-coverage.mjs`: run it bare for the
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
  pinned in the `webgpu` project instead), and `UNREACHABLE` (the
  big-endian platform guard; the SHAPE_MASK field invariant).
  **A third list exists because the tool measured its own error.**
  Line-level lcov attributes the body of a *module-level arrow const*
  to the module-evaluation count, so `exportScale`'s guard in
  `renderer.mts` reads as covered in Node — where there is no renderer
  at all.  Calibration: of the 14 throw sites under `BROWSER_ONLY`,
  exactly two read as covered, and one of those (`GlyphBuffer.set`)
  genuinely is (a Node spec drives it with a mock device).  So the
  known error is one site in 191; it is listed in `MISATTRIBUTED` with
  the cause, and the script documents that its tally is a **lower
  bound** on dead sites rather than an exact count.  Both footguns the
  round hit are recorded in the file header — the transpiled-offset
  trap that made the first measurement fiction, and the useless
  function-level records.
  5 specs in `test/modules/gpu-throw-coverage.mjs` (the precedent is
  `gpu-benchmark-report.mjs`: a tool's parser gets a fixture, not
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
  tests, 91/91 `webgpu` and 75/75 `webgpu-visual` against a freshly
  built bundle, typecheck, lint, `test:types:all`, JSDoc coverage
  100%, and `gpu-throw-coverage` at 0 Node-reachable dead sites.**
  **Round 30 is complete.**

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
`dist/cytoscape-gpu.d.ts` tells them to.  The replacement text already
exists one file over (29.3's message: a `case` mapper for conditionals,
`data(key)` scales for per-element values).
A scan of every other advice-giving message in `src/gpu` found no
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
  `cytoscapeGpu` and expected not to throw.  A message that advises a
  rejected form is only detectable if the advice is executed.
  Control: the old advice restored → the spec fails.
  `dist/cytoscape-gpu.d.ts` is regenerated and committed (the comment
  is shipped hover text — the whole reason the defect mattered), and
  `test:types:gpu` re-run: 37 type exports, 3 statics, 1093 doc blocks.
  2483 Node tests, typecheck, lint, JSDoc 100%, and — since this pass
  changes source — 91/91 `webgpu` and 75/75 `webgpu-visual` against a
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
  `wheelSensitivity`, and the three thresholds).  Each states the
  condition rather than the fact — `wheelSensitivity` throws on
  non-*positive* where the thresholds allow 0, and `mount` names its
  three distinct failures — because "throws on bad input" in a comment
  is not worth the line.
  `auditThrowTags()` joins `scripts/gpu-jsdoc-coverage.mjs` and its
  tally prints under the coverage report (`--verbose` lists the
  offenders).  It **under-detects deliberately**: a member that throws
  only through a helper it calls is not flagged, because whether that
  is part of *its* contract needs a human.
  **This one is gated**, in `test/gpu-jsdoc-coverage.mjs`, where round
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
  `dist/cytoscape-gpu.d.ts` is regenerated and committed (1093 doc
  blocks).  2485 Node tests, 68 module tests, typecheck, lint.
- [x] **31.3 `mouseout` and `pointercancel`** (2026-08-03) — landed, 2
  specs in the `webgpu` project.
  `mouseout` is the plain sibling gap: hover on, assert `mouseover:a`;
  move *within* the node and assert no `mouseout` (the half that makes
  it a hover-boundary test rather than a "some event fired" test);
  move off and assert `mouseout:a`.
  `pointercancel` is driven with **synthetic `PointerEvent`s** rather
  than `page.mouse`, because the handler matches the cancel against the
  press's `pointerId` and only a synthetic event lets the spec choose
  it.  (`capture()` already swallows the `setPointerCapture` throw that
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
  93/93 `webgpu` and 75/75 `webgpu-visual` against a freshly built
  bundle, typecheck, lint, `test:types:all` with the regenerated
  `dist/cytoscape-gpu.d.ts`, JSDoc coverage 100% and `@throws` 16/16,
  and `gpu-throw-coverage` still at 0 Node-reachable dead sites.**
  **Round 31 is complete.**

## Round 32 plan — `@param` completeness (planned 2026-08-03)

Round 31 closed the `@throws` half of round 26's contract sentence
("what it takes, what it returns, what it throws").  This round closes
**what it takes**, and stops there deliberately.

**Why `@param` and not `@returns`.**  Round 26 recorded docmaker's
per-function shape: `{ name, descr, formats: [ { descr, args: [ { name,
descr } ] } ] }`.  Arguments have a **description field the generator
emits**; there is no return field at all.  So a missing `@param` is a
hole in the release documentation v4 will ship, while a missing
`@returns` is editor hover text only.  That is a boundary in the
already-decided design rather than an arbitrary cut, which is what
makes this round no-call work.

**Measured** (public tier — the nine `PUBLIC_API` files, overload-aware
so an implementation signature closing a run of documented overloads is
not counted): **221 public members take parameters; 143 document them
and 78 do not.**  The convention is established practice at 65%, not an
open question — round 26 simply stopped at doc-comment *presence*.
By file: `collection.mts` 28, `animation.mts` 18, `core.mts` 13,
`viewport.mts` 8, `style.mts` 8, `layout/contract.mts` 3.

**The `@returns` tail is measured and logged, not built**: **63 of 276**
value-returning public members lack the tag.  It is worth doing, and it
is worth doing when someone is generating the docs and can see what
reads badly — nothing downstream consumes it today.
*(This figure was first published as "133 of 348" — from the same
throwaway scan that misreported the `@throws` count in the round-31
plan, counting `if(`/`for(` as members and not skipping the
implementation signature that closes a run of overloads.  Re-measured
2026-08-03 with the overload-aware scanner the shipped audits use.
Third time that scan has produced a wrong number in a plan: use
`auditParamTags`/`auditThrowTags` as the template, not a fresh
regex.)*

**Pass split** (docs in-commit; one commit per file group):

- [x] **32.1 `core.mts` + `viewport.mts`** (2026-08-03) — 21 members;
  143 → 164 of 221.  These are generator output, so each says what the
  argument *means*: `animate()`'s opts names the override order and the
  panBy/pan throw, `setZoom`'s option form is the
  keep-this-point-stationary case, `stop()`'s `jumpToEnd` is the
  difference between applying the targets and freezing where the tween
  reached.
- [x] **32.2 `collection.mts`** (2026-08-03) — 28 members; 164 → 192.
  Two wording calls worth recording.  The thirteen compound and DAG
  traversals take the same optional `criterion`, so they share one
  sentence rather than thirteen paraphrases — a generator emits them
  side by side and they should read as one family.  And the overloaded
  readers describe the *forms* rather than naming a type: `data()`'s
  args line lists its four spellings, `relativePosition`'s `dim` covers
  read-pair / read-axis / write-pair, and `style()`'s `value` is
  documented as never valid, since it exists only so the setter form
  throws instead of silently ignoring it.
- [x] **32.3 `animation.mts` + `style.mts` + `layout/contract.mts`**
  (2026-08-03) — 29 members; **221/221**.  The clock parameters are
  where a description earns its line: `now` is the *shared* clock in
  every one of them, which is what makes the CPU settle and the GPU
  evaluation agree, so each says so instead of "the current time".
  `setPositions` documents the packing (`xy[i*2]` lands on `slots[i]`)
  — the one thing a layout author must get right — and `refreshMapped`
  says `keys` is the gate on what re-evaluates, not merely a record of
  what was written.
- [x] **32.4 The audit + gate, and the closing sweep** (2026-08-03) —
  `auditParamTags()` joins `auditThrowTags()` in
  `scripts/gpu-jsdoc-coverage.mjs`, overload-aware through the same
  regexes, public tier only, printed under the coverage report and
  listed by `--verbose`.  Gated in `test/gpu-jsdoc-coverage.mjs` under
  31.2's reasoning: documentation completeness is already a gated
  concern here, so this maintains an existing gate.
  Controls: a `@param` line deleted → 1 failing; an undocumented
  parameterized member added to `viewport.mts` → 3 failing; the audit
  short-circuited so it checks nothing → 1 failing (the
  non-trivial-count guard).
  Docs: the README's JSDoc section carries the rule and the reason the
  boundary sits where it does, and its header carries round 32.
  Verification: **2487** Node tests (the gate's own two specs are the
  round's only additions — 32.1–32.3 changed comments alone), 68 module
  tests, typecheck, lint, JSDoc coverage 100%, `@throws` 16/16,
  `@param` 221/221, and the regenerated `dist/cytoscape-gpu.d.ts`
  (comments only in `src/`, so the browser suites are unaffected).
  *(First written as 2485: the verification run's tally was read from a
  grep that missed the line.  Caught by the docs sweep below, which is
  the argument for re-running a tool rather than re-reading a record.)*
  **Round 32 is complete.**

## Round 33 plan — the benchmark sweep (planned 2026-08-03)

Rounds 29–32 worked one axis in four passes: what exists and is
asserted by nothing (29), what throws and is *run* by nothing (30),
what those throws say when they fire (31), and what the shipped
documentation states about what a member takes (32).  This round takes
the same question to the third measurement axis — **what costs what** —
and the starting answer is that roughly a third of the prototype has no
benchmark at all, while the report's job table runs eight jobs out of
fourteen suites.

The round's scope, set by the user (2026-08-03): **benchmark
everything possible** — core, elements, layouts, algorithms, the store,
the style engine, loading, interaction, the renderer.  Not "add a few
suites": close the gap between what v4 claims about its performance and
what a single command can reproduce.

### Code investigation (2026-08-03, precedes this plan)

**What exists** — 14 Mitata suites, the browser renderer bench, and
the report harness (`bench-run.mjs`, `graph.mjs`, `report.mjs`,
`report-html.mjs`, `render-stats.mjs`):

- **In the job table** (`report.mjs`, quick profile — eight jobs):
  `index.mjs` (= `core.mjs` + `collection.mjs`), `materializers`,
  `mutators`, `scenarios`, `traversal`, `algorithms` (twice — at 2k,
  and at 500 for the superlinear ops the 2k run gates off), `mappers`.
  `--full` adds the 20k/200k matrix, with `BENCH_OP` splitting
  `mutators`/`scenarios` one group per process at 200k.
- **Standalone, by hand only** — the six of open call 7:
  `compaction` (19.5), `labels` (16.5), `transitions` (24.2),
  `geometry-tween` (25.6), `compound` (14.12), `curves` (29.4).
- **Browser** — `render-bench.mjs`: six scenes (25k and 100k flat,
  ndex-x-large, 25k curved, 25k compound, 25k images), opt-in behind
  `--renderer`, needing built bundles and a real adapter.

**What is unmeasured.**  Fifteen findings, each a surface the docs
describe and no suite prices:

1. **Layouts: nothing at all.**  Six built-ins (`grid`, `preset`,
   `circle`, `concentric`, `breadthfirst`, `random`) plus `force`, and
   not one Node benchmark — the only layout numbers in this file are
   the pass-1 record's grid figure (200k nodes 270 → 24 ms, from
   one-off profiling of the perf-round-2 slot path) and the browser
   bench's `--layout` force-vs-cose mode, run once on the RX 580.  The
   `layoutPositions` plumbing (spacingFactor/transform/fit, the
   animated path) and the round-17 contract's `ctx.setPositions` are
   likewise unpriced, and the contract is the surface external authors
   build on.
2. **The algorithm tail.**  `algorithms.mjs` prices 18 rows covering
   17 of the 21 algorithms: `kMedoids`, `fuzzyCMeans`,
   `affinityPropagation`,
   `kargerStein` and unnormalized `degreeCentrality` have no row, and
   the *weighted* variants of `betweennessCentrality` and
   `closenessCentrality` (the branch that actually runs a heap) are
   only exercised unweighted.
3. **The style engine.**  `cy.style(sheet)` compile + `applyAll`,
   the first apply of elements added inside a batch, the round-4
   selection-restyle skip (`dependsOnSelection`), the round-14.6
   parents-overlay partition, and the stored-truth readback getters
   (`style()`/`renderedStyle()`/`numericStyle()`) are all unpriced on
   their own.  A whole-sheet swap appears in `transitions.mjs`, but
   only as a transitions-off-vs-on ratio, and in `scenarios.mjs` as
   one step of the refresh trace.
4. **Loading and the wire format.**  The init figures this file
   quotes most (definition-form 662 → 236 ms, columnar 80 ms,
   deserialize ~5 ms, 9.2 MB vs 30 MB) come from one-off profiling of
   ndex-x-large during the pass-1 follow-ups.  There is no suite:
   `toColumnarElements`, `serializeElements`/`deserializeElements`,
   `cy.serialize()` and the three `options.elements` forms have no
   re-runnable row.  Round 29's survey dropped this as "already
   priced", which is exactly the assumption this round exists to
   question — **a number nobody can re-run is a record, not a
   measurement.**
5. **CPU picking.**  `pickNodeAt` is the pointer layer's hot path and
   is priced only *inside* `compaction.mjs`, as a peak-vs-compacted
   before/after.  Nothing measures it against v3's renderer pick, or
   across the shape branches round 27 added (the round-* offset
   polygon, `barrel`'s four sampled beziers, the custom polygon blob
   walk), or with `text-events` label boxes in the scan, or at
   different zooms — and 28.1 recorded `insideRoundPolygon` as the one
   shape test that is not affine-invariant, so zoom is a real axis.
6. **Box selection.**  `elementsInBox`/`refsInBox` appears once, as a
   curve *premium* row in `curves.mjs` (3.29× — a figure 33.5 then
   found to be measuring a degenerate call; really ~2.3×).  Its
   absolute cost,
   and the comparison against v3's `getAllInBox`, are unmeasured — as
   are the round-16.5 label-containment term and the round-20.2
   interactive filter.
7. **Bounds and fit.**  The whole-graph scan is priced only in
   fragments: label terms in `labels.mjs` (~0.1 µs/label), the curve
   premium in `curves.mjs` (1.05–1.16×), a parity control in
   `compaction.mjs`.  The pass-1 fast-path figure (ndex 235 → 15 ms)
   is another one-off.  Nothing prices `boundingBox`/`fit`/
   `getFitViewport`/`boundingBoxAt` against v3 across graph sizes.
8. **The data() sidecar.**  One `data set` row in `mutators.mjs`,
   which its own record calls GC-noisy at 200k.  Unmeasured: the
   per-column kind split (f64 + present mask vs dictionary strings vs
   the plain-array fallback), dictionary growth and the round-11
   refcount/compaction path, `removeData`, whole-object `data()`
   reads, and the `DataStore.reader` hoisting the scan paths depend on.
9. **Queries beyond flag scans.**  `materializers.mjs` covers the
   `(mask, want)` flag scans thoroughly.  The round-10 A8 **data
   conditions** (`{ data: { weight: { gt: 0.5 } } }` — per-key readers
   hoisted out of the loop) and the round-14.7 **structural terms**
   (`{ parent: true }`) have no row, though both are the documented
   replacement for v3 selectors people will benchmark against.
10. **Events.**  The whole emit surface rests on one figure — ~85
    ns/listener call, from round 5's scenario sweep.  Unmeasured: cost
    by qualifier kind (ref-qualified vs predicate vs unqualified core),
    scaling in listener count, the listener-gated no-op path that most
    of the write side depends on for its numbers, and — the claim most
    worth pinning — round 14.5's **"the flat no-compounds path stays
    byte-identical (zero cost)"**, which no measurement has ever
    checked.
11. **The animation manager.**  `transitions.mjs` and
    `geometry-tween.mjs` price *ticks*, thoroughly.  Nothing prices
    animation **start/stop**, the round-21 channel-eviction compare
    (`touchedColumns()` across shared refs — the per-start cost that
    replaced the queue), `delay`, the round-24.3 controls, or the
    viewport path.
12. **Images and charts.**  The round-15 registry (url dedup,
    refcounts, tier assignment, the blob records) and the round-23
    chart blob writes have no CPU sweep; `chart-values` via the
    `{ data }` passthrough refreshes per data write and is unpriced.
    On the device side the `gen-25k-images` scene has **never been
    measured** — 15.7 recorded "software adapter on this box", which
    2026-08-03 corrected as wrong for the third time.
13. **Store internals.**  `compaction.mjs`'s churn section proves the
    round-11 reclaims *hold* (blob KB, dict entries, CSR shape) but
    prices none of them: the id-map probe/insert and blob compaction,
    the `Adjacency.rebuild` two counting passes, `CurveBlob` waste
    reclaim, and `DirtyTracker` span coalescing are all unpriced, and
    they are what every bulk path funnels through.
14. **Renderer-bench gaps.**  Beyond the images scene: `--layout` has
    been run once (2026-08-01); the 100k and ndex scenes have not been
    re-run since round 27 (29.5 deliberately scoped its comparison to
    the four 25k scenes); no scene exercises the round-22 visibility
    split, the round-20.2 `events` pick mode, or a label-heavy wrapped
    configuration — the one round 25.6 named as the expensive case.
15. **The report understates the suite.**  Open call 7: six suites are
    outside the job table, the renderer bench is opt-in, and there is
    no profile that runs everything.  A reader of `report.html` sees
    less than half of what has been measured.

**Negative results, recorded so they are not re-derived.**

- **`benchmark/` (v3's own suites) stays untouched.**  It runs against
  `documentation/`-era fixtures and the v3 API, and v3 is frozen until
  v4 ships.  v3 comparisons belong in `benchmark/gpu/`, where
  `graph.mjs` already builds one element list for both factories.
- **The anti-hoisting methodology does not need revisiting.**
  `core.mjs`/`collection.mjs` rotate operands over a pool of K = 8 so
  V8 cannot hoist a pure loop-invariant call out of the measured
  region — the fix that stopped `same()` mis-reporting by five orders
  of magnitude.  New suites reuse it rather than inventing a harness.
- **Suite health is not the problem.**  30.0 re-ran all six standalone
  suites at `BENCH_N=2000`, exit 0 apiece.  This round is coverage and
  reporting, not bit-rot.

### Design calls (round 33)

1. **A benchmark is either v3-comparative or gpu-only, and says
   which.**  A comparative row needs an *idiomatic* v3 analogue on the
   other side (the `cmp( name, v3Op, gpuOp )` shape the suites already
   use where the dialects differ); everything else is a gpu-only
   absolute cost, or a premium against a v4 baseline of the same shape
   (the 29.4 form).  No row fakes a comparison by benchmarking v4
   against a v3 call that means something else — the report's speedup
   overview is only worth reading if every 1× line is real.
2. **Every performance claim in the docs gets a re-runnable source.**
   The round's honesty rule, and the direct analogue of round 30's
   throw coverage: a figure quoted in `src/gpu/README.md` or this file
   either becomes a row in a suite, or is marked in place as a
   **historical one-off** with the date and machine it came from.  The
   four that matter most are the init figures (finding 4), the grid
   layout figure (1), the fit fast-path figure (7) and the emit figure
   (10).
3. **Standalone suites join the report; the report gains a profile
   that runs everything.**  `report.mjs`'s job table takes all
   fourteen suites, with a `gpuOnly: true` marker for the ones that
   have no v3 side, so `report-html.mjs` renders them as absolute
   costs rather than against a 1× reference line that means nothing
   for them.  `--all` runs every suite plus the renderer bench.  This
   closes open call 7 with the answer the user's scope implies.
4. **Warmup and deferral discipline is mandatory, and stated per
   suite.**  29.4's two corrections are the standing method: whichever
   side is measured first pays the module's JIT warmup (a drag read
   2.52× and settled at 1.16× once both sides were warm), and v4
   **defers derivation to the first read**, so a row that writes and
   never reads measures a flag write.  Every new suite documents which
   of the two it had to handle, in its header.
5. **A row that reads ≈1× is checked before it is reported.**  The
   generalization of the same pass: parity is a finding only after the
   row has been shown to be measuring the thing it names.  Two of
   29.4's rows were not.
6. **Scale points are declared, not implied.**  Comparative suites run
   the existing 2k/20k/200k ladder (`BENCH_N`), superlinear ops gate
   on it, and any group whose 200k form exceeds the heap with two live
   instances runs one group per process via `BENCH_OP` — with the
   `report.mjs` op tables kept in step with the group names, which is
   the coupling that already exists for `mutators`/`scenarios`.
7. **Numbers are recorded as factors first.**  Wall figures are
   machine-local (the RX 580 / i9-9900K box these rounds have used);
   the round record states the machine once and reports ratios and
   per-element costs, the convention 25.6 and 19.5 already follow.
8. **A benchmark-coverage audit ships, and reports only.**  The third
   tool in the `gpu-jsdoc-coverage` / `gpu-throw-coverage` family:
   `scripts/gpu-bench-coverage.mjs` maps a maintained manifest of
   public surfaces to the suites that price them and lists what has
   nothing.  It **always exits 0** — a benchmark floor is a policy
   call, and the mapping is a name-mention scan whose limits are
   recorded up front (round 31's event survey misreported 31 names
   because browser specs register them from an array, and the same
   failure mode applies here).  It answers "is this still true?" for
   the claim this round is making, and nothing stronger.

### Pass split (docs in-commit; each pass its own commit(s))

- [x] **33.0 Docs-first** (2026-08-03) — this plan section, open call 7
  marked scoped, and the README's Benchmarks section opened with the
  round's two rules (a row is v3-comparative or gpu-only and says
  which; every figure has a re-runnable source or is marked a
  historical one-off).  Landed before any suite, and amended in the
  same commit with the breadth pass 33.9 on the user's restatement of
  scope.
- [x] **33.1 Layouts** (2026-08-03) — landed as
  `benchmark/gpu/layouts.mjs`, and **two of its first rows were not
  measuring anything**, which is design call 5 earning its place on the
  first pass that used it.
  Rows (i9-9900K, N=2000 / 4000 edges, `fit: false` and a shared
  explicit `boundingBox` on both sides — a headless v3 viewport is
  1×1 px, so a viewport-sized layout would pack 2000 nodes into a
  pixel): **grid 153×**, preset map-form 21×, preset fn-form 32×,
  circle 9.9×, concentric 20×, breadthfirst 32×, random 6.9×, and an
  `eles.layout()` 10% scope 5.6×.  The slot-path/handle-path split the
  plan predicted shows up exactly: grid is the outlier because it is
  the one layout that never materializes a handle.  At N=500 the same
  rows read 84× / 23× / 32× / 9.1× / 20× / 36× / 7.1× / 6.0×, and the
  `force` CPU executor runs 20 iterations in 4.81 ms (29.5 ms at 2k)
  against v3 `cose` at 10 iterations — **48×**, the two capped
  identically, and gated to N ≤ 500 because cose is superlinear (4.5 s
  per iteration at 25k on the hardware-pass box).
  **The two corrected rows.**  `preset` first read **2388×**, which is
  not a layout result: with no `positions` v4's preset does *no work at
  all* (positions are already in the model — its own module comment
  says so) while v3 still walks every node.  It now passes a real
  `positions` map, which is both the honest comparison and the real use
  case (restoring saved positions), plus a second row for the fn form
  since that one takes handles by contract on both sides.  And the
  contract row first compared `{ impl: BulkLayout }` against the
  built-in grid at 4.5× — **not a comparison**, since the two place
  different positions by different maths, so it measured the impl's own
  body as much as the wrapper (design call 1).  It is now an empty impl
  against the same wrapper doing a full bulk placement.
  **The finding that came out of that row.**  The contract's fixed cost
  scales with the *graph*, not the run: **106 µs at 500 nodes, 391 µs
  at 2000, for an impl that does nothing.**  `GpuLayoutContext`'s
  constructor eagerly evaluates `cy.elements()` and `.nodes()` to
  populate the handle-tier `ctx.eles`/`ctx.nodes`, so every run interns
  handles for the whole graph — including for a columnar-first layout
  that never touches them, which is the case the contract exists to
  make obvious.  Making those two fields lazy getters would delete it.
  **Logged, not fixed**: this is a measurement round, and `eles` is a
  declared public field of the shipped declarations.
  Also priced: the `layoutPositions` finisher against the bare bulk
  write underneath it — 1.68× at 2k (804 → 478 µs), the cost of v3's
  spacingFactor/transform/fit conveniences.
  Control: every built-in was run against a 200-node fixture seeded at
  one shared position and asserted to place **200 moved, 200 distinct**
  positions, so no row is measuring a layout that silently does
  nothing — the check `preset` failed.
- [x] **33.2 The algorithm tail** (2026-08-03) — landed in
  `algorithms.mjs`, taking it from 18 rows over 17 algorithms to 25
  over all 21.  At N=500: `kMedoids` **1.25×**, `fuzzyCMeans` 1.11×,
  `affinityPropagation` 1.64×, `kargerStein` 1.06× — parity, which is
  the *correct* reading for these four and the one the plan predicted:
  they are attribute-space algorithms that v4 deliberately keeps
  handle-level on both sides (round 10 A4 — feature space, not
  adjacency walks), so identical maths dominates and a large win would
  have meant the row was wrong.  They sit beside the existing
  dense-matrix rows (floydWarshall 1.2× *to v3*, markov 1.34×,
  hierarchical 1.02×) which read the same way for the same reason.
  The two that are not parity are the ones with a real implementation
  difference: **weighted `betweennessCentrality` 8.9×** and weighted
  `closenessCentrality`, which are the branch that actually runs the
  heap — every centrality row before this round passed no weight, so
  round 10 A3's decrease-key heap (v3 re-sorts instead) had never been
  measured.  Unnormalized `degreeCentrality` joins its normalized
  sibling, the 29.2/30.3 shape arriving in the benchmark suite.
  Iteration counts are capped on both sides (AP 10, kMedoids 10, fcm
  10) so the rows measure the algorithm and not how long each
  implementation happens to wander; `kargerStein` is randomized on both
  sides and neither takes a seed, so what is stable is its *cost* (the
  trial count is a function of n) and its result is not compared.
  One methodology note worth keeping: a one-off probe had `kMedoids`
  reading 1.4× *slower* on v4, which did not survive mitata warming
  both sides — the 29.4 lesson, reproduced.
- [x] **33.3 The style engine** (2026-08-03) — landed as
  `benchmark/gpu/style.mjs`, and it found **the place where v4 does not
  beat v3**, which no previous round had looked at directly.
  At N=2000 (2000 nodes / 4000 edges, constants-only sheets alternating
  so no apply can be skipped as unchanged): a whole-sheet swap is
  **1.09×** — parity — at 14.2 ms for 6000 elements, or ~2.4 µs per
  element for what is supposed to be a columnar write.  Compile alone
  is 27.7 µs (separated from apply through the public batching
  semantics: inside a batch `cy.style()` compiles and validates and
  defers the apply), so **the whole 14 ms is the apply**.  The first
  apply of a 256-node band on `add()` is 1.36× v4's way, and the
  round-14.6 parents partition costs 1.08× against the same graph
  without the hierarchy (100 parents over 2000 leaves).
  **The finding: the style getters are 13–21× *slower* than v3.**
  ***Corrected by round 34.0 (2026-08-03): 5.8×, not 13–21×.*** These
  numbers come from a suite that imports `src/` through tsx, and
  profiling `readProp` for round 34 found **23% of its samples in
  `__name`** — esbuild's name-preserving wrapper, an
  `Object.defineProperty` per closure *creation*, injected by tsx and
  absent from the built bundle.  Through
  `build/cytoscape-gpu.esm.mjs` the same getter is **292 ns** against
  v3's 50 ns.  The gap is real and round 34 fixes it; the magnitude
  below is inflated by the transpiler.  The rest of this record stands
  — the *localization* (all of it inside `readProp`, against a 9 ns
  column read) was measured the same way on both sides.*
  `ele.style( 'background-color' )` is 2.13 µs on v4 against 106 ns on
  v3; `style( 'width' )` 15×, `numericStyle` 13×, `renderedStyle` 2.0×,
  whole-object `style()` 2.2×.  Localized, not just observed: the cost
  is entirely inside `StyleEngine.readProp` (1.85 µs measured directly
  against the ref, so the collection wrapper is not it) while the
  column read underneath it is **9 ns** — a ~200× gap between the read
  and its data.  It is flat across props (background-color, width and
  label all ~1.85 µs), which rules out the switch walking to a late
  case and points at the per-call setup: `readProp` is a ~536-line
  method with a 145-case switch that allocates four closures before it
  dispatches.  This matters more than a micro-benchmark usually would,
  because these getters are the documented public read path — the
  synchronous-reads invariant is what round 8 called load-bearing, and
  `renderedStyle`/`numericStyle` sit on it.  **Logged, not fixed**: a
  measurement round measures, and hoisting the closures out of
  `readProp` is a source change with its own verification.
  *Plan correction, recorded*: the **selection restyle skip** cannot be
  benchmarked as this plan described it.  The round-4 finding compared
  a sheet with and without a `:selected`-dependent block, and v4 has no
  selection-dependent blocks at all — they left with the selector
  removal and the accent ring is shader-drawn, so there is nothing to
  turn on and off.  What survives of that comparison is the plain
  select/unselect round-trip, which `mutators.mjs` has priced since
  round 4 (~38× at 200k).  The suite header says so rather than the
  row silently not existing.
  Two rows were corrected before landing (design call 5, twice in two
  passes): the compound row first read 3.55× *faster* than flat, which
  was 4000 edges missing from one side rather than the partition being
  free; both sides now come from one generator.
- [x] **33.4 Loading and the wire format** (2026-08-03) — landed as
  `benchmark/gpu/load.mjs`.  At N=2000 (6000 elements): definition-form
  init is **5.47×** v3 (153 → 28 ms, construct *and* dispose on both
  sides), v4's own three ingest forms are 25.7 ms (definitions) / 17.7
  (columnar) / 17.0 (wire), and the def-clone control that the def rows
  necessarily pay is 628 µs — so the columnar and wire payloads are
  ~1.5× v4's own definition path, not the headline the pass-1 record's
  ndex figures suggest at a different scale and fixture.  Conversion:
  `toColumnarElements` 789 µs, `serializeElements` 967 µs from
  definitions and 211 µs from columnar, and **`deserializeElements`
  4.09 µs** — 52–236× cheaper than every other path in the group, which
  is the wire format's whole point (numeric columns deserialize as
  zero-copy views) and is now a row rather than a recollection.
  `cy.json()` is 1.17× and `cy.serialize()` 5.5× cheaper than
  `cy.json()` on the same graph; a 256-node band `add()` is 1.39×, and
  the three forms of the same add are 3.04 / 2.76 / 2.77 ms.
  **Two methodology bugs in this suite's own first version, pulling in
  opposite directions**, which is why the number moved from 1.89× to
  5.47×: a headless v3 defaults `styleEnabled` to *false*, so the v3
  side was doing less work than v4 (which always applies its sheet);
  and v3's default layout is **grid**, so `cytoscape( { elements } )`
  ran a whole layout inside the measured region.  The v3 side is now
  `styleEnabled` with an explicit preset layout — the configuration
  `scenarios.mjs` and `layouts.mjs` already use, for exactly these
  reasons.
  Also recorded in the header: the def-form rows **must** clone inside
  the timed region, because a factory consumes its definition objects
  (v3 adopts position objects by reference and writes through them —
  measured: positions read back as {0,0} from the second iteration on),
  which is why the clone gets its own control row.  Columnar and wire
  payloads are re-used as-is, verified by reading positions and data
  back after repeated loads — and that re-use is the realistic case.
- [x] **33.5 Pick, box selection and bounds** (2026-08-03) — landed as
  `benchmark/gpu/spatial.mjs`.
  *Plan correction, measured*: picking and box selection **cannot** be
  compared against v3, because `findNearestElement` and `getAllInBox`
  live on v3's canvas renderer and a headless v3 instance has neither
  (`cy.renderer()` is a bare object on which both are `undefined`).
  They are gpu-only absolute costs; bounds is the one of the three v3
  answers headless, and it stays comparative.
  **Picking.**  A hit is ~20 µs and a background miss 42 µs at N=2000
  (the full descending walk — the hover-over-background case).  The
  shape branches are **invisible at realistic density**: the scan stops
  at the first candidate whose box contains the point, so exactly one
  inside-test runs per pick and all seven shapes read within 3% of each
  other.  A row per shape would have been seven copies of the walk
  wearing different labels — so the shape tests get their own fixture
  (N coincident oversized nodes, the point inside every box and outside
  every shape, so the walk runs N tests and misses all of them), and
  there the spread is real: ellipse 88 µs, `cut-rectangle` 97 µs,
  custom `polygon` 212 µs, `star` 242 µs, `barrel` 789 µs,
  `round-hexagon` 823 µs — **9.6× between the cheapest and the dearest
  inside-test**, with round 27's two computed shapes at the top.
  `insideRoundPolygon`'s cost turns out to be zoom-*independent*
  (1.05× between zoom 1 and 2) even though its correctness is not —
  worth knowing, since 28.1 had to pin it at two zooms for exactly the
  opposite reason.  `text-events: yes` costs **2.9×** on the miss walk
  (the laid label box joins the scan per candidate).
  **Box selection.**  `elementsInBox` is 153 / 214 / 370 µs over 10 /
  50 / 100% of the graph, and the round-16.5 label-containment option
  adds 15%.
  **Bounds** (v3-comparative, labels included by default per 16.4):
  whole-graph `boundingBox()` **6.2×**, `cy.fit()` **33×**,
  `getFitViewport()` **35×**, one node's `boundingBox()` 1.6×.  Turning
  the label terms off is 1.73× — so the honest default row is the
  expensive one, which is why both are reported.  v4-only rows for
  reference: `boundingBoxAt` 1.65 ms whole-graph, `labelBoundingBox`
  465 ns per element.
  **Two rows were void before they were fixed, and one of them was
  already shipped elsewhere.**  (a) `elementsInBox` takes four numbers,
  not a box object; passed an object it silently answers the *empty*
  collection (0 elements against 480 for the same band spelled
  positionally), so the first version of the box rows measured a
  degenerate call — and `benchmark/gpu/curves.mjs` has had the same bug
  since round 29.4, in a number `src/gpu/README.md` publishes.  Fixed
  and re-measured in its own commit (33.5b below).  (b) the
  custom-`polygon` row read 549 ns against 88–842 µs for every other
  shape, because the box corner is *inside* that polygon, so the walk
  stopped at the first node: one test, not N.  Each shape now has its
  own miss point, and the suite **asserts the miss** at startup — a row
  that hits prints a warning naming itself, because a shape-test row
  that stops early is measuring nothing.
- [x] **33.6 The data sidecar and structured queries** (2026-08-03) —
  landed as `benchmark/gpu/data.mjs`.  At N=2000, bulk writes across
  the whole node set are **18–24× v3** and the storage kind barely
  moves it: numeric 24×, dictionary string (4 values) 19×, one new
  dictionary entry per pass 18×, the plain-array object fallback 23×.
  `removeData` is 1.7×.  Reads are parity — one numeric key 1.04×, one
  dictionary string 1.34× *v4's way* (the decode is cheaper than v3's
  object hop) — with one exception recorded as a finding: **the
  whole-object `data()` read is 6.3× slower on v4** (266 ns against
  42 ns), because v4 rebuilds the object from its columns where v3
  hands back the object it already stores.  That is the columnar
  trade-off showing up exactly where the design predicts, and it is
  worth knowing before someone writes `data()` inside a loop.
  **Structured queries against the selector strings they replaced** —
  the comparison a porting v3 user actually makes: data equality 15.6×,
  a comparison (`gt`) 11.9×, two keys AND-ed 12.7×, membership (`in`)
  14.9×; the predicate form (both sides materializing handles) is the
  narrow one.  Structural terms are the widest: `{ parent: true }`
  **49.8×** against `:parent`, `{ child: false }` **48.5×** against
  `:orphan`, `{ parent: false }` 16.3× against `:childless` — pure
  flag scans against v3's per-element pseudo evaluation.
  One row is named for what it does rather than what it was meant to
  do: a "dictionary churn" row would need per-element distinct strings,
  which takes a per-element loop that would measure the loop on both
  sides rather than the column.  The row writes one *new* value across
  the collection per pass, so the dictionary grows by an entry per pass
  and not per element, and it says so.
- [x] **33.7 Events and the animation manager** (2026-08-03) — landed
  as `benchmark/gpu/events.mjs`, and it produced the round's second
  finding about a documented claim.
  **Emits** (a position write on one node, N=2000): with **no listeners
  26×** v3 — that is the listener-gated fast path every bulk-write
  number in `mutators.mjs` rests on, now measured at 53 ns against
  v3's 1.39 µs — one core listener 4.4×, one ref-qualified element
  listener 4.4×, a delegated listener 4.9× (v3's selector string
  against v4's predicate — the idiomatic spelling on each side), ten
  core listeners 2.6×.  `on()` + `off()` registration is 1.17×.
  **The finding: a compound child never gets the no-listener fast
  path.**  Round 14.5 says the *flat* path "stays byte-identical (zero
  cost)", which is a claim about the path bubbling does not apply to
  and is not re-measurable without the pre-14.5 code — so this suite
  measures the other half instead, which nothing had: what the phased
  walk costs when it *does* apply.  With one core listener, a child two
  ancestors deep costs **2.35×** an orphan's emit (1.29 µs vs 551 ns).
  With **nothing listening at all** it costs **6.4×** (566 ns vs
  89 ns) — so the phase walk runs regardless of whether any phase has
  a listener, and a compound graph pays it on every position write.
  That is a real optimization opportunity (hoist the whole-chain
  listener check ahead of the walk) and is **logged, not fixed**.
  **The animation manager**, whose *lifecycle* had never been priced —
  only its ticks: v4 is **4.3× slower than v3 to start and stop one
  element's animation** (5.45 µs vs 1.26 µs) and 5× slower on
  `delay()`, but **3.7× faster** starting and stopping the same
  animation over a 512-node collection (127 µs vs 469 µs).  So the
  capture-into-ChannelWrites design carries a per-animation constant
  that amortizes at scale — v3 wins the single-element case, v4 wins
  the bulk case, and both are worth knowing since a UI does the former
  and a layout the latter.  The round-21 **eviction compare costs
  nothing measurable**: starting an overlapping animation reads
  identically to starting a disjoint one (10.32 vs 10.35 µs), so
  `touchedColumns()` across shared refs is not a cost worth avoiding.
  The 24.3 controls are 3.4 µs (pause + resume) and 4.3 µs (reverse).
- [x] **33.8 Images, charts and store internals** (2026-08-03) —
  landed as `benchmark/gpu/store.mjs`, gpu-only throughout because v3
  has no counterpart to any of it.  The structures are driven directly
  rather than through the public API, so a row is the structure's cost.
  At N=2000: the **id index** builds in 307 µs (2000 `set`s), and its
  single-key ops are `has` 55 ns / `get` 62 ns / `hashAt` 7.6 ns /
  `idAt` 9.2 ns — the last of which is the *memoized* hit, since
  `idAt` caches the decoded name per slot; the cold UTF-8 decode is not
  separable through the surface, and that is the useful fact (an id
  decodes once per slot, ever).  A remove + re-set round-trip, which is
  what drives the round-11 blob reclaim, is 250 ns.
  **CSR adjacency** rebuilds 4000 edges in 66 µs (the two counting
  passes), and its reads are the design in three numbers: `outDegree`
  **6.5 ns** — the O(1) claim, measured — `outEdges` 48 ns,
  `connectedEdges` 183 ns; an overlay add + remove is 147 ns.
  **The blob pool** writes 2000 records in 127 µs, rewrites one in
  place in 32 ns (the same-length fast path), reads `offsetOf` in
  4.6 ns, and pays 181 ns for a free + rewrite.
  **The dirty tracker**, which every column write in the store funnels
  through, marks in 13.7 ns contiguous / 19.2 ns scattered and drains a
  64-mark frame in 742 ns.
  **The image registry** (round 15's bookkeeping, headless — no
  decoder): 214 ns to acquire a url already known (the icon-per-type
  case) and 636 ns for a fresh entry plus its release.
  **Charts**: a `chart` sheet with per-element `{ data }` values costs
  **1.01×** the same sheet without one — the blob record per node is
  noise beside the apply it rides in, which is the 33.3 finding showing
  up from the other side.  A data write refreshing every node's
  `chart-values` is 529 µs.
- [x] **33.9 The remaining public surface** (2026-08-03) — landed as
  `benchmark/gpu/surface.mjs`: **90 rows, 80 of them v3-comparative**,
  covering the members no dedicated suite touches — the viewport
  quartet and its compute-without-committing twins, introspection and
  the gating flags, batching, the iteration/comparison/set-building
  surface, traversal, degree, the rendered-coordinate accessors, the
  curve accessors, the compound traversals, the flag families, element
  data/json/scratch.  Every op is **smoke-tested once before it is
  benched**, and the ones that could not be called are reported by
  name rather than silently dropped: `midpoint`/`renderedMidpoint` and
  the two endpoint accessors have no headless v3 side (they go through
  the renderer — the same cause as 33.5's pick), so those rows are
  gpu-only.
  *(This record said "three"; the suite reports **four**.  The fourth is
  `core: zoomRange get [v3]`, which throws headless in v3 independently
  of anything v4 does — verified directly in round 36.3, which noticed
  the discrepancy while adding rows.  An off-by-one in the record, not a
  regression.)*
  Most of the surface is where the earlier rounds said it would be:
  set ops 4–175×, traversal 1.3–4×, `reset()` 127× and `viewport()`
  77×, `collection()` 8.9×, batching ~7×.  **Four rows go the other
  way, and they are the pass's value:**
  - **`mutableElements()` — v4 251 µs against v3's 120 ns.**  v4's is
    `elements()`, so it materializes the whole graph on every call
    where v3 answers in constant time.
  - **`indexOf()` — 12.5 µs against 204 ns** over a 2000-collection:
    v4 scans linearly where v3 keeps an index.
  - **`effectiveOpacity()` 34× slower** (4.7 µs vs 313 ns) and the
    `takesUpSpace`/`interactive`/`transparent` trio 11× — all three
    read through the style engine, which is 33.3's `readProp` finding
    arriving from a second direction.
  - `json()`/`jsons()` are ~1.2× v3's way, the columnar
    rebuild-the-object cost 33.6 found on `data()`.
  Two rows are named for their mechanism rather than their multiplier,
  because the multiplier is not about v4: core `data()` and `scratch()`
  read as ~8,600× and ~87,000×, and the cause is that a **styled** v3
  runs a whole-graph style update on any core data *or scratch* write
  (1.9 ms here, against 1.1 µs for the same instance unstyled).  That
  is a real cost a v3 app pays, so the rows stay — but a reader should
  not take 87,000× as a statement about v4's scratch.
- [x] **33.10 The report: every suite, one command** (2026-08-03) —
  landed, and **open call 7 is answered**.  `report.mjs` now has three
  tiers instead of two: `quick` (the v3-vs-v4 micro and scenario suites
  at their default scales — deliberately unchanged, because a default
  profile nobody waits for is worth as little as a report showing half
  the suite), **`--all`** (+ the fifteen standalone sweeps: the eight
  this round added plus `compaction`, `compound`, `curves`, `labels`,
  `transitions`, `geometry-tween` and the algorithms' superlinear
  tier), and `--full` (+ the 2k/20k/200k matrix).  `--suite <substr>`
  filters any tier, which is how one sweep gets run and re-rendered on
  its own.
  The blocker was mechanical and is now gone: `curves.mjs` and
  `labels.mjs` **time one shot per row** rather than sampling through
  mitata — deliberately, since their rows mutate or are one-offs — so
  they had no mitata results to hand over and wrote their own JSON
  shape (or none), which `report.mjs` cannot read (it needs
  `job.groups`).  `finishManualRun( suite, groups )` in `bench-run.mjs`
  turns one-shot rows into that shape via `oneShotStats`, the
  convention the renderer bench already uses for its init/export
  timings.  No suite's terminal behaviour changed: without `BENCH_JSON`
  it writes nothing, exactly like `finishRun`.
  The renderer already handled gpu-only groups (benches not named
  `v3`/`gpu` render as individual labelled rows rather than as
  dumbbells against a 1× line that would mean nothing for them), so no
  `gpuOnly` marker was needed — the plan's proposed flag turned out to
  be describing something the report already did.
  Verified end to end: `report.mjs --all --suite labels` runs the suite
  and its five rows appear in `report.html`.  `test/modules/
  gpu-benchmark-report.mjs` gains three specs (the manual-run shape,
  the no-`BENCH_JSON` no-op, and a single-bench section rendering) —
  14 module tests, with the control run: breaking `finishManualRun`'s
  group mapping fails the spec written for it.
- [x] **33.11 The renderer bench gaps** (2026-08-03) — run on the
  RX 580 (`amd gcn-4`, dpr 2, 1280×800, render scale pinned to 1).
  **The images scene is measured at last** — round 15.7 recorded
  "software adapter on this box", which was wrong for the third time
  in this file's history, and 29.5 scoped its comparison to four
  scenes without it.  It holds the **vsync floor (16.7 ms wall) in
  every pan scenario**, labels on and off, where v3 canvas runs
  333–760 ms/frame; device time is 3.44 ms fit-all, 4.46 zoomed-in,
  1.42 far-zoom, with labels adding ~0.3 ms.  Init 294 ms against
  v3's 3510 (12×); `png()` full export 290 ms against 4666 (16×).
  **The 100k and ndex scenes are re-measured post-round-27**, closing
  the scope limit 29.5 left deliberately: 100k device 9.29 ms fit-all
  / 18.68 zoomed-in / 1.63 far-zoom, and 20.06 ms for the
  zoomed-in-with-labels pass — against the 2026-08-01 hardware pass's
  19.6 ms for that same worst-case row, i.e. **+2.3%**, inside the
  +0.3–3.6% band 29.5 measured for round 27's shader branches on the
  25k set.  ndex fit-all device 36.96 ms (the pass recorded ~37 ms)
  at 33.4 ms wall — two vsync frames, still the one scene above the
  floor — with pick p50 **0.3 ms** off the CPU fast path, init 1648 ms
  against v3's 17070 (10×), and a full png export 213 ms against 6125
  (29×).  Both scenes' compaction rows reproduce round 19.5b:
  100k device **2.21 → 0.53 ms** (4.2×; 19.5b recorded 2.2 → 0.5).
  **Two scenes added**, the configurations nothing exercised:
  `gen-25k-wrap` (round 25.6's expensive label case — wrapped
  multi-line labels — measured on the device rather than on the CPU
  tick) and `gen-25k-invisible` (round 22's paint-only `visibility`
  and round 20.2's `events` transparency, half the nodes each,
  expressed as `case` mappers on the v4 side and selector blocks on
  v3's).  A same-session run of the whole 25k family gives them a
  baseline (device p50, ms):

  | 25k scene | fit-all | fit-all + labels | zoomed-in + labels |
  |---|---|---|---|
  | flat (baseline) | 3.40 | 3.67 | 4.77 |
  | curved (bezier pairs) | 9.89 | 10.17 | 4.17 |
  | compound (1k parents) | 2.11 | 2.34 | 4.50 |
  | images (icon-per-type) | 3.44 | 3.71 | 4.80 |
  | **wrapped labels** | 3.40 | **4.55** | **5.95** |
  | **half-invisible / half-inert** | **1.66** | **1.96** | **2.57** |

  Two results worth keeping.  **Wrapped labels cost +24% on the
  labelled passes** (3.67 → 4.55 fit-all, 4.77 → 5.95 zoomed-in) — and
  that scene's *unlabelled* row is 3.40 ms, identical to the
  baseline's, which is the control: the delta is the labels and
  nothing else.  And **half-invisible is 2.05× cheaper than the
  baseline** (1.66 vs 3.40): the round-22 `FLAG_DRAWN` mask drops
  invisible elements in the **cull**, so they cost no vertex or
  fragment work at all rather than being discarded late — a design
  claim from that round, unmeasured until now.  The image pass costs
  ~1% over the flat scene at this scale (3.44 vs 3.40).
  Two notes for whoever re-runs this: the harness printed
  "build/ bundles are older than src/" throughout, which was a **false
  positive** — the only `src/` file this round touched is
  `src/gpu/README.md`, and the check compares mtimes without
  distinguishing docs from code; and `--scene gen-25k` is a substring
  filter, so it selects the whole 25k family, which is how the
  same-session baseline for the two new scenes was obtained.
- [x] **33.12 `scripts/gpu-bench-coverage.mjs` + the closing docs
  sweep** (2026-08-03) — the audit landed first (its record is above,
  under the surface pass it drove), then the sweep.
  **The README's Benchmarks section is now an index**: a table of every
  suite and what it answers (21 rows over the 22 files —
  `core`/`collection` share `index.mjs`), the three report profiles, the
  `finishManualRun` note, the round's five findings, and the audit with
  its limits.  Its follow-up hooks gained a "five measured slow paths"
  entry so the findings are reachable from the doc a reader starts in.
  **`AGENTS.md` gained two benchmark notes**, both earned this round: a
  row is guilty until it discriminates (with all six of the round's
  non-measuring rows named, including the `elementsInBox` signature
  trap that had been live in `curves.mjs` since 29.4), and a v3 side
  needs `styleEnabled` *and* an explicit layout, because the two
  defaults bias in opposite directions.  `scripts/` picked up the third
  audit in the repo-structure list, and `package.json` gained
  `benchmark:gpu:all`.
  **The three named drift sites, checked by name**: "Suggested
  sequencing" gained the round-33 paragraph; the "Needs a call" ledger
  needed nothing (round 33 closed no design calls — it is measurement
  work); "Gaps with direction already set" likewise.  Open call 7 is
  struck through with what closed it.  The status header at the top of
  this file was two rounds stale when the round started (it ended at
  30) and now runs through 33.
  **Round 33 is complete.**

### What the round found (2026-08-03)

The wins were mostly where earlier rounds said they would be — bulk
writes 18–24×, structural queries 16–50×, layouts 7–153×, fit 33×,
algorithms unchanged where the maths is identical and 8.9× where the
data structure differs.  The **useful** output is the other direction.

**Five slow paths, each localized, none fixed** (a measurement round
measures; every one of these is a source change with its own
verification, and three of them touch shipped declarations):

1. **`StyleEngine.readProp`** — the style getters run 13–21× v3 as
   measured through tsx (**5.8× through the built bundle — see the
   round-34.0 correction**; 292 ns vs 50 ns) with a **9 ns** column
   read underneath.  Flat across props, so it is the per-call
   setup: a ~536-line method with a 145-case switch that allocates four
   closures before dispatching.  `numericStyle`, `renderedStyle`,
   `effectiveOpacity` and the `takesUpSpace`/`interactive`/
   `transparent` trio all ride it.  Biggest surface of the five.
2. **The compound emit path never takes the no-listener fast path** —
   a position write on a node two ancestors deep costs 6.4× an
   orphan's *with nothing listening* (566 ns vs 89 ns), because the
   phase walk runs before anything checks whether a phase has a
   listener.
3. **`GpuLayoutContext` materializes the whole graph per run** — the
   layout contract's fixed cost is 391 µs at 2000 nodes for an impl
   that does nothing, because the constructor eagerly evaluates
   `cy.elements()` and `.nodes()` for the handle tier, including for
   the columnar-first layouts the contract exists to encourage.
4. **`mutableElements()`** does the same per *call* — 251 µs against
   v3's 120 ns.
5. **`indexOf()`** scans where v3 indexes — 12.5 µs against 204 ns
   over a 2000-element collection.

**Six rows were caught measuring nothing**, by design call 5, and
rewritten: `preset` (2388×, because v4's preset does no work without a
`positions` map while v3 walks every node), the compound style row
(3.55× "faster", because one side was built without edges), the
layout-contract row (comparing two different placements), the
custom-polygon pick row (1500× faster, because the pick point was
*inside* the shape so the walk stopped at the first node), and two
box-selection rows — which turned up the round's one **defect in
shipped documentation**: `cy.elementsInBox` takes four numbers and
silently answers the empty collection when handed a box object, so
`curves.mjs`'s box-selection premium had been measuring a degenerate
call since round 29.4, and the README published it as 3.29× (really
~2.3×).

**Two methodology traps, both now in `AGENTS.md`:** a v3 side needs
`styleEnabled: true` *and* an explicit layout (unstyled v3 does less
work than v4; v3's default layout is grid and runs inside the measured
region — fixing both moved 33.4's init comparison from 1.89× to
5.47×), and a benchmark row is guilty until shown to discriminate.

### Verification (2026-08-03)

Typecheck, lint, **2487 Node tests** and **77 module tests** (68 → 77:
three report specs and six for the new audit, each with its control
run), JSDoc coverage 100%, `@throws` 16/16, `@param` 221/221, and
`gpu-throw-coverage` still at 0 Node-reachable dead sites — the three
existing audits are unchanged, which matters because this round edited
the gated one (`auditFile` now also returns the members it saw).
No `src/` code changed: the round's only source edit is
`src/gpu/README.md`, so the browser suites are unaffected and were not
re-run.  The renderer benchmark ran on the RX 580 (33.11).

### Risks tracked

- **Benchmark bloat vs signal.**  Fourteen suites become ~twenty, and
  a full profile that nobody waits for is worth as little as a report
  that shows half the suite.  Mitigation: the quick profile stays
  quick (default scales only), `--all` is the opt-in, and the round
  records the wall time of each profile so the cost of running it is
  itself a documented number.
- **v3 comparisons that are not comparisons** (design call 1).  The
  most likely offenders are the layout rows — v3's layouts take
  different options and, for cose, a wholly different quality target —
  and the loading rows, where v3 has no columnar or wire form.  Where
  no honest comparison exists, the row is gpu-only and says so.
- **Fixture drift.**  `graph.mjs` builds one degree-4 grid graph; the
  new suites need compound, curved, labelled and imaged fixtures.
  These should extend `graph.mjs` (the existing shared seam) rather
  than each suite growing its own generator — the failure mode is six
  slightly different "20k graphs" whose numbers cannot be compared.
- **Heap ceilings at 200k.**  Two live instances of a 200k graph
  already force one-group-per-process for `mutators`/`scenarios`; the
  style, spatial and data suites will hit the same wall, and the
  `BENCH_OP` tables in `report.mjs` are a hand-maintained coupling to
  group names that silently degrades when a group is renamed.
- **Randomized and deferred work** (design calls 4–5).  `kargerStein`,
  the force executors and anything reading derived geometry are the
  rows most likely to measure variance or a deferred no-op.  Each gets
  the 29.4 treatment: force the work, then check the row can move.
- **The audit over-claiming** (design call 8).  A name-mention scan
  will report a surface as benchmarked because a suite happens to
  mention it, and will miss one exercised through a wrapper.  It
  reports, it does not gate, and the header says which direction it
  errs in.

## Round 34 plan — fixing what round 33 measured (planned 2026-08-03)

Round 33 measured the prototype and found five paths slower than v3 or
than v4's own design implies, logging each rather than fixing it because
a measurement round measures.  This round fixes them.  It is the first
round in a while whose commits change `src/`, so the browser suites are
back in the verification gate.

**A correction first, and it changes one of the five.**  Profiling
`StyleEngine.readProp` before touching it showed **23% of its samples in
`__name`** — esbuild's name-preserving wrapper, an
`Object.defineProperty` per closure *creation*, which tsx injects and
which does not exist in the built bundle (`grep -c __name
build/cytoscape-gpu.esm.mjs` → 0).  Measured through the bundle instead,
the same getter is **292 ns, not 2.0 µs**, against v3's 50 ns: the real
gap is **5.8×**, not the 13–21× round 33 published.  The finding is real
and worth fixing; its magnitude was inflated by the transpiler, in a
suite that imports `src/` directly.

That is the round-30 lesson ("coverage of transpiled sources needs
source maps, or it lies") in a second guise, and it generalizes: **for
closure-heavy hot paths, benchmarking the tsx sources measures the
transpiler.**  Recorded in `AGENTS.md`, and the other four findings were
re-measured through the bundle before any fix (they hold: they allocate
little and are dominated by real work).

**The five, re-measured through `build/cytoscape-gpu.esm.mjs`** — these
are the numbers the round is judged against, at N=2000 nodes / 4000
edges on the i9-9900K:

| path | v4 before | v3 | gap |
|---|---|---|---|
| `ele.style( 'background-color' )` | 292 ns | 50 ns | 5.8× |
| phased emit, no listeners | 530 ns | (flat: 112 ns) | 4.7× |
| layout contract, empty impl | 333 µs | — | O(V+E) per run |
| `cy.mutableElements()` | 121 µs | 18 ns | O(V+E) per call |
| `eles.indexOf( ele )` | 3.63 µs | 45 ns | 81× |

**Design calls (round 34):**

1. **Behaviour is preserved exactly; these are not semantics changes.**
   Every fix keeps the observable contract — element order, event
   ordering and phase semantics, the values getters return.  Where a
   fix could change something visible (the `elements()` memo returns the
   *same object* to two callers where it used to return two), that is
   called out and pinned by a spec.
2. **Each fix is measured before and after, through the bundle**, and
   the round record carries both numbers.  A fix that does not move its
   number is reverted, not shipped with a story.
3. **The order-list scan is the contract for "all elements in order".**
   `nodeSlots()` currently walks handles; the replacement walks the same
   insertion-order list `scanRefsInto` walks, so layouts see identical
   order — which matters, since grid and circle assign positions by
   index.
4. **No public *semantics* change; one public *shape* change.** Making
   `GpuLayoutContext.eles`/`.nodes` lazy turns two readonly fields into
   getters, which is a `.d.ts` shape change (property access is
   unaffected).  `dist/cytoscape-gpu.d.ts` is regenerated and
   `test:types:gpu` re-run.
   *Wrong, as it turned out (34.6): `GpuLayoutContext` is not in the
   shipped declarations at all — it appears only inside a doc comment —
   so the getters change no public shape.  What did reach the `.d.ts`
   is the store's two new members (`structureEpoch`, `scanSlotsInto`),
   since `cy._store` is typed; 1093 → 1097 doc blocks.*

**Pass split** (tests-first; docs in-commit; each pass its own commit):

- [ ] **34.0 Docs-first** — this plan, the round-33 correction recorded
  in its own record and in the README, and the `AGENTS.md` note about
  benchmarking transpiled sources.
- [x] **34.1 `indexOf` is O(1)** (2026-08-03) — the lazily-built
  packed-key membership `Set` became a `Map` from key to *first index*.
  Set membership only ever asks `.has()`, which a Map answers
  identically, so the ten set-op call sites are untouched; `indexOf`
  now reads the index straight out of the same cache instead of
  re-packing every ref in a linear scan.
  **12.5 µs → 42 ns** at N=2000 (measured through the sources on both
  sides), which is **parity with v3's 42 ns** — the 81× gap is gone
  rather than narrowed, because the cache the set ops already build was
  carrying the answer all along.
  `indexOfId` is deliberately **not** changed: it compares each
  handle's cached `_id`, which still resolves for a *removed* element
  held in a collection, and answering it from the store's id index
  instead would quietly change that.  It was not one of the five.
  Tests-first: two specs in `test/gpu-collection-reference.mjs` pinning
  that the two consumers agree whichever builds the cache first (a
  wrong shared cache shows up as one of them answering differently),
  and that every element of a 40-element collection reports its own
  index.  2489 Node tests.
- [x] **34.2 `elements()` memoized against a structure epoch**
  (2026-08-03) — `GraphStore` gained `structureEpoch`, bumped at the
  three places an element enters or leaves the insertion-order list
  (`allocSlot`, `freeSlot`, the bulk id path) and on compaction, and
  the core memoizes the three **unfiltered** collections against it
  (`elements()`, `nodes()`, `edges()` with no query — a query argument
  is never memoized).
  **121 µs → 18 ns** for `mutableElements()` at N=2000, against v3's
  14 ns: parity, from an O(V+E) scan plus a handle intern per element.
  `elements()` is 16 ns and `nodes()` 19 ns on repeat.
  *A deliberate visible consequence*: two calls with no structural
  change between them now return **the same collection object** where
  they returned two equal ones.  Collections are immutable snapshots,
  so nothing can observe this except identity itself — and a spec pins
  it rather than leaving it to be discovered.
  Why a counter and not a count: `add` one, `remove` another between two
  calls leaves the count identical and the *set* different, so a
  count-keyed cache would answer the second call with a dead ref and a
  missing element.  Six specs in `test/gpu-core-api.mjs`, and the two
  controls that matter were run: keying the cache on element count
  instead of the epoch fails the add-one-remove-one spec, and dropping
  the `freeSlot` bump fails the add-and-remove spec.  Style, position
  and data writes deliberately do *not* invalidate — pinned by a spec
  that also reads the new values back through the cached collection,
  since a collection holds refs into the columns rather than a copy of
  them.
- [x] **34.3 The phased emit takes the no-listener fast path**
  (2026-08-03) — landed, **and it corrected the finding on the way in**.
  The gate itself: `_emitOnEle` returns before building the event or
  walking ancestors when nothing listens for the type.  Sound because
  v4's emitter never bubbles to a parent (`bubble` defaults false and
  v4 does not override it), so an emit with no matching listener is
  observably a no-op.  **338 ns → 8 ns** for a node two ancestors deep
  and 159 → 6 ns for an orphan, with a listener present unchanged.
  *Correction to round 33's finding 2, measured*: the row that finding
  used — `child.position()` at 6.4× an orphan's with no listeners —
  **never reached `_emitOnEle` at all**.  The position writers already
  gate on `hasListeners( 'position' )` (as do `add`, `remove`, `data`
  and `move`), so what that row measured is the **compound auto-bounds
  invalidation**: a child's position write marks its ancestor chain
  geo-stale, which is round 14.3 working as designed, not a defect.
  What *is* true is the narrower claim this pass fixes: `_emitOnEle`
  itself did no listener check, so it cost 338 ns on a compound child
  before discovering nobody cared.
  That still matters, because **the pointer layer's sixteen call sites
  are ungated** — `mouseover`/`mouseout`, `pointerover`/`pointerout`,
  `tap`, `tapselect`/`tapunselect`, the box family — and they fire on
  hover transitions and pointer moves, which is the latency path.
  Four specs in `test/gpu-compound-events.mjs` pin the boundary from
  both sides, with two controls run: making the gate unconditional and
  gating it on the wrong type each fail 12 of the file's 13 specs.
- [x] **34.4 The layout contract stops materializing the graph**
  (2026-08-03) — two changes, and the second is the one that mattered.
  `eles`/`nodes` became **lazy getters**, so a columnar layout that
  never asks for handles never builds them; and `nodeSlots()`/
  `edgeSlots()` stopped walking those handles at all, reading slots
  from the store's insertion-order list (whole-graph scope) or the
  scope collection's refs (subset scope).  `GraphStore.scanSlotsInto`
  is the slot-only twin of `scanRefsInto` — same walk, same
  `(mask, want)` test, no `Ref` allocated — and the per-element filter
  became one mask: alive, not a parent, not locked.
  **391 µs → 1.72 µs** for an empty impl at 2000 nodes / 2000 edges
  (~230×), and a subset scope's is 875 ns.  A columnar bulk placement
  over the whole graph is 57.6 µs, which is now *the placement*; an
  impl that does ask for `ctx.nodes` still pays 122 µs, unchanged and
  by design — you pay when you ask.
  The risk here was **order**, since grid and circle place by index, so
  a different enumeration order is a different layout.  Five specs in
  `test/gpu-layout-contract.mjs` pin `nodeSlots()`/`edgeSlots()` as
  *exactly* `cy.nodes()`/`cy.edges()` order, the locked/parent
  exclusions, subset order, and that `eles`/`nodes` still answer when
  an impl does ask.  Control: enumerating in reversed slot order
  instead fails 2 of the 43 specs across the contract and layout files.
  Landed with a repeat of this codebase's most familiar bug: inserting
  `scanSlotsInto` above `scanRefsInto` **stranded the latter's doc
  block**, which the round-26 coverage gate caught immediately — the
  ninth instance of the pattern, and the first one a gate found rather
  than a reader.
- [x] **34.5 `readProp`** (2026-08-03) — landed as **two** fixes,
  because the planned one turned out to be a no-op in production and
  design call 2 says a fix that does not move its number is not shipped
  with a story.
  *(a) The closures, hoisted.*  The five column readers built inside
  `readProp` became module-level helpers taking `(store, slot, id)`.
  Under tsx this is **1848 ns → 255 ns** — because each closure
  creation also paid esbuild's `__name` wrapper — but **in the bundle
  it is 292 → 288 ns, which is noise**: V8 creates closures cheaply
  when nothing is decorating them.  So this half fixes the *harness*
  (every Node test and benchmark runs through tsx) and not the product.
  Kept, and reported as exactly that.
  *(b) `normalizeProp`, memoized* — the fix that moved the production
  number.  Profiling the **bundle** put **36.4% of `readProp` in
  `normalizeProp`** and another 4.5% in its `([A-Z])` regex: every
  style read was doing a regex replace and a lowercase allocation to
  turn `backgroundColor` into `background-color`, before the 145-case
  switch it precedes.  A `Map` cache (bounded at 512 entries, since an
  unknown name is normalized *before* it is rejected) takes
  `ele.style( 'background-color' )` from **292 ns → 122 ns** against
  v3's 52 ns — the gap goes **5.8× → 2.3×**.  `numericStyle` 215 → 84
  ns, `effectiveOpacity` 240 → 92 ns, `style( 'width' )` 227 → 89 ns.
  Three specs in `test/gpu-style-getters.mjs`: both spellings answer
  identically, a restyle is visible through both, and an unknown name
  still throws — twice, so a cached normalization cannot turn the
  second call into a silent success.  Control: making the memo return
  the raw name fails 3 of the file's 19 specs.
  Landed with the *tenth* instance of the stranded-doc-block pattern
  (my comment displaced `normalizeProp`'s JSDoc), caught by the gate
  again.
- [x] **34.6 Verification + closing sweep** (2026-08-03).
  **The five, before and after, through `build/cytoscape-gpu.esm.mjs`**
  at N=2000 (the `style` row from a dedicated process — a micro-row in
  a shared one varies ±30% run to run, which is itself worth knowing):

  | path | before | after | v3 |
  |---|---|---|---|
  | `ele.style( 'background-color' )` | 292 ns | **122 ns** | 52 ns |
  | `_emitOnEle`, nothing listening | 338 ns | **8 ns** | — |
  | layout contract, empty impl | 333 µs | **795 ns** | — |
  | `cy.mutableElements()` | 121 µs | **20 ns** | 18 ns |
  | `eles.indexOf( ele )` | 3.63 µs | **41 ns** | 41 ns |

  Three of the five are now at parity with v3 or better; the style
  getter is 2.3× (from 5.8×) and the two v4-only paths are 420× and
  42× cheaper than they were.
  **Verification**: typecheck, lint, **2508 Node tests** and 77 module
  tests, JSDoc 100% with `@throws` 16/16 and `@param` 221/221,
  `gpu-throw-coverage` at 0 Node-reachable dead sites, the regenerated
  `dist/cytoscape-gpu.d.ts` (1093 → 1097 doc blocks — the store's two
  new members) with `test:types:gpu` clean, and — since this round
  changes `src/` — **168/168 browser specs** across `webgpu` and
  `webgpu-visual` against a hand-rebuilt bundle (an `http-server` *was*
  listening on 3333, which is exactly the standing trap, so
  `test:playwright:build` was run by hand first).  Goldens are
  byte-stable and the parity scenes read their recorded values
  (`parity-charts-pie` 0.000%, `parity-casing` 0.061%,
  `parity-polygon` 0.005%): **the five fixes change no pixels.**
  Docs swept: the README's Benchmarks section carries the before/after
  for each path and its follow-up hooks strike the five through; the
  three benchmark suites whose comments recorded the findings now
  record the fixes and say they stay as the rows that would notice a
  regression.  The three named drift sites need nothing — round 34
  closes no design calls and opens none.
  **Round 34 is complete.**

**Risks tracked**: the `elements()` memo going stale on a path that
mutates the graph without touching the order list (mitigated by bumping
at the order list itself, which is the one structure every add and
remove passes through); the emit gate skipping an emit that some code
depends on for a side effect other than its listeners (mitigated by the
`bubble: false` argument and by the event-order specs); `nodeSlots()`
changing layout order (mitigated by walking the same order list, and
pinned by the layout suites' exact-position expectations); and
`readProp`'s size making a mechanical edit error-prone (mitigated by
typecheck plus the readback specs, which assert values per prop).

## Round 35 plan — the style-read dispatch table (planned 2026-08-03)

Round 34 left the style getters at 2.3× v3 with "no obvious cause — it
is the 145-case switch and the guard lookups that precede it", and
logged that as appetite rather than a decision.  The maintainer's
reaction to that sentence is this round: **145 cases is a code smell;
why is there not a direct lookup?**  Both halves of that turn out to be
right, and the second is measurable.

**Why there are so many cases** — this part is not accidental
complexity.  `readProp` answers *every readable style property* from
stored truth, and each property has its own storage: a column, a
packing, a fold, a sidecar entry, or a derived record.  **150 case
labels over 111 groups** in the big switch (plus four in the small
transition-config switch above it; 153 distinct readable properties in
all), median **2 lines** each, 49 of them one-liners.  It is a dispatch
table that happens to be written as control flow — the vocabulary's
size, not repeated logic.
*(This paragraph first said "153 labels over 97 groups", from a
throwaway parse that mis-split labels written several to a line.  The
figures here are the shipped transformer's, which 35.2's table is built
from.  Fourth time a hand-rolled scan has produced a wrong count in a
plan — the standing advice to reuse the audits' scanner applies to
one-off analysis too.)*

**Why the shape costs something.**  V8 does not hash a string switch
this large.  Measured two ways:

- *Synthetically*, a generated 145-case string switch costs 48.7 ns at
  the first case, **552.9 ns at the last**, and 336 ns rotating across
  the range; a `Map` dispatch to the same readers is **14 ns** and
  position-independent.
- *In the real method*, moving `border-width`'s case — body untouched —
  from position #6 to the tail took it from **56 ns to 90 ns** through
  the built bundle.  (Less than the synthetic gap, because the real
  switch has grouped labels and early-exit branches above it, so V8
  manages some of it better; the effect is still ~1.6× on an identical
  body.)

So a property's cost depends on where it happens to sit in the file —
which is exactly the kind of thing that should not be true, and why the
round-33/34 measurements (which used `background-color`, the **4th**
case) understated the getters for everything else.

**Design calls:**

1. **The switch becomes a `Map` from property name to a reader
   function** — `( engine, ref, store, slot ) => value` — built once at
   module load.  Dispatch is one `Map.get` plus a call, the same for
   every property.  This is the structure the code already *is*; the
   round makes it data instead of control flow.
2. **Value-for-value equivalence is the acceptance test, not a
   sample.**  86% of the readable props (132/153) have a spec that
   passes them to a getter today, which is not enough to refactor 524
   lines behind.  35.1 therefore lands a **characterization spec
   first**: every property in the table, read on a styled node *and* a
   styled edge, asserted against the values the current implementation
   returns.  It is explicitly a refactor guard — it pins *what v4 does
   today*, bugs included — and it closes the 21-prop readback gap
   permanently.
3. **Fall-through groups stay one reader with several keys**, so the
   19 grouped labels do not become 19 copies.
4. **If the transformation cannot be completed safely, it is
   abandoned, not half-done.**  A hybrid (table plus a residual switch)
   would be worse than either.

**Pass split** (tests-first; docs in-commit):

- [ ] **35.0 Docs-first** — this plan.
- [x] **35.1 The characterization spec** (2026-08-03) —
  `test/gpu-style-readback-all.mjs`: 153 properties × a styled node and
  a styled edge, 306 assertions, generated from the implementation as
  it stood and **seen green before 35.2 touched anything**.  The 117
  rows that read `undefined` are pinned too — they are how a node-only
  property stays node-only.  Controls: making one property read the
  wrong column fails 1 spec; letting a node-only property leak onto
  edges fails 1.
- [x] **35.2 The dispatch table** (2026-08-03) — the switch is gone.
  `PROP_READERS` is a module-scope `Map` of 111 readers over 150
  labels (nine readers deliberately answer several labels), and
  `readProp` is now **60 lines**: the guards, then a `Map.get` and a
  call.  A reader takes only the arguments it uses, in the order
  `( store, slot, ref, engine, prop )`.
  Encapsulation held: the readers need five engine members
  (`defFor` ×21, `store` ×6, `defs` ×4, `labelChannels` ×2,
  `readImageProp` ×1), all private, so rather than widen the class the
  engine builds **one narrow `ReadContext` per instance** — arrow
  functions capturing `this`, with `store`/`defs` as accessors because
  a sheet swap replaces `defs` wholesale and a snapshot would hand
  every reader the previous sheet.
  Three parser bugs were found and fixed *before* applying anything,
  by inspecting the generated table rather than by running it: labels
  written several to a line (`case 'a': case 'b':`) were silently
  dropping 12 of the 150; a nested switch inside one reader body
  confused a depth-based split; and section comments written above a
  case were being pulled into the *previous* reader, which is this
  codebase's stranded-comment pattern in a new costume — they now lead
  the group they document.
- [x] **35.3 Measure + sweep** (2026-08-03) — **the table flattens the
  cost; it does not lower all of it.**  Through the built bundle, by
  the property's old position in the switch:

  | property (old position) | switch | table |
  |---|---|---|
  | `border-width` (#6) | 56 ns | 73 ns |
  | `background-color` (#4) | 108 ns | 110 ns |
  | `text-wrap` (#73) | 56 ns | 52 ns |
  | `text-max-width` (#74) | 59 ns | 48 ns |
  | `taxi-radius` (#142) | 115 ns | 91 ns |
  | `target-distance-from-node` (#150) | 286 ns | **108 ns** |

  The spread was **56–286 ns (5.1×)** and is now **48–110 ns (2.3×)**:
  the worst property is **2.6× faster**, the earliest few are ~15 ns
  slower (a `Map.get` costs what the switch's first comparisons did
  not), and cost no longer depends on where a property sits in a file.
  The aggregate is the number that matters, since `style()` with no
  argument reads every property of the group: **19.95 → 15.71 µs on a
  node (1.27×) and 30.87 → 20.92 µs on an edge (1.48×)** — edges gain
  more because edge properties sat at the back.
  **Verification**: typecheck, lint, **2662 Node tests** (2508 + the
  154 characterization specs), 77 module tests, JSDoc 100% with
  `@throws` 16/16 and `@param` 221/221, throw coverage 0 dead,
  `test:types:gpu` clean (1098 doc blocks; the `.d.ts` gained only the
  private `readCtx` line), and **168/168 browser specs** against a
  hand-rebuilt bundle with goldens byte-stable and parity scenes at
  their recorded values.
  **The same shape exists in the write path and is deliberately left
  alone.**  `applyProp` — the constant-resolution half of the engine —
  is a 147-case switch of exactly the same kind.  It is *not* hot: it
  runs from `resolveConst`, which is called three times at construction
  and once per group per `cy.style( sheet )`, not per element and not
  per read.  33.3 measured a whole sheet compile at **27.7 µs**, so the
  switch there costs a handful of dispatches per sheet swap against
  ~6000 per whole-object read on the other side.  Recorded so the next
  reader does not pattern-match the shape and "fix" the one that never
  mattered — the read path earned the change because of how often it
  runs, not because a big switch is wrong on sight.
  **Round 35 is complete.**

**Risks tracked**: a mis-transcribed case silently returning the wrong
value (mitigated by 35.1, which is written and seen passing against the
*old* implementation first); `this` capture inside reader bodies (each
becomes an explicit `engine` parameter); and the megamorphic call site
defeating inlining, which is why the round measures rather than assumes.

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
   `@throws` and `@param` are both complete.  Re-measured against the
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
   `benchmark/gpu/style.mjs` and `surface.mjs` — the suites whose rows
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
  A description, not a type restatement.  What they carry that the
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
  leaving one bare.  It was **shipping**: `dist/cytoscape-gpu.d.ts`
  carried both blocks stacked, so a consumer hovering `lineOpacityConst`
  read a paragraph about arrow colours first.  Round 31.1's defect class,
  live.  (b) **The `@param` gate had never walked exported functions** —
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
  `pair()` helper beside `cmp()`/`only()`.  At N=2000 over a 100-element
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
  `webgpu-visual`), goldens byte-stable.
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
  pass.  Against that pass's 697 / 1472 / 952 ms and 15.5 s the rows
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
  round recorded: **quick 7.1 min, `--all` 17.4 min**.  The runner
  prints its own total, so this was always one run away.  `--full` is
  unmeasured — it adds the 2k/20k/200k matrix and is the profile nobody
  runs casually, which is the point of keeping quick quick.
  **(c) The style getters through the bundle.**  Rounds 34 and 35
  published their headline figures from *throwaway* harnesses, which
  contradicts round 33's design call 2.  `benchmark/gpu/style-bundle.mjs`
  is now that source and joins `--all`; it imports
  `build/cytoscape-gpu.esm.mjs` and warns when the bundle is older than
  `src/`.  Running it under `--import tsx` was **measured** to be
  identical rather than assumed safe (the `__name` wrapper is injected
  when esbuild transpiles a `.mts`, and this suite is plain JS importing
  plain-JS bundles), which is what lets it share the report's existing
  spawn.
  Round 35's numbers reproduce — 68 ns at the old sixth case, 53 and 50
  in the middle, 93 and 110 at the back — **and one is refined**: the
  post-table spread is *two populations, not one*.  A colour-valued read
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
  proof.  Reporting-only for a second reason beyond round 32's boundary:
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
  `dist/cytoscape-gpu.d.ts` regenerated (1097 doc blocks) — the six
  un-stranded blocks move onto their real members there, which is the
  point of the fix.

**Verification (2026-08-04)**: typecheck, lint, **2663 Node tests**, 97
module tests, **172 browser specs** (97 `webgpu` + 75 `webgpu-visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types:gpu` clean, JSDoc coverage
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

## Design sitting (2026-08-04, fifth) — the production-readiness roadmap

Every open call in the ledger, taken with the maintainer in one
sitting; the per-item decisions are recorded in "Open calls for the
maintainer" near the top of this file, and the rounds below execute
them.  The sitting's own record, briefly:

1. **`border-style`/`outline-style`: full coverage** — every shape,
   the polygon perimeter tier included (round 38).
2. **Strictness resolves at the type layer, not the runtime.**  The
   constructor stays runtime-permissive (tsc's excess-property check
   is the typo guard — v4 does not replicate at runtime what the
   build checks); event names stay open because custom events
   (`node.emit('foo')`) are supported API and cannot be gated.
3. **The v4 Event is built** — typed `target`, populated
   `originalEvent`, **functional `preventDefault()`** (the
   maintainer's amendment to the proposal, which had dropped it), no
   namespaces (round 41).
4. **Packaging: v4 becomes the package.**  v4's source promotes from
   `src/gpu/` to `src/` and becomes the default export of
   `cytoscape@4`; the entire v3 file set moves into a self-contained,
   still-buildable **`v3/`** directory (parity and comparison
   benchmarks keep working against it), and no v3-specific file
   remains outside it (rounds 42–43).
5. **Gates: throw coverage and `@returns` both gate** (round 37);
   stranded blocks and bench coverage stay report-only.
6. **Aliases split**: `roundrectangle` drops, `autolockNodes`/
   `autoungrabifyNodes` are kept as recorded exceptions (round 37).
7. **The small feature calls**: overlap box mode, graph-level data in
   the wire format, and `cy.gc()` all build (round 39);
   core/collection extension points stay demand-gated deferred.
8. **The error policy is the one question deliberately left open.**
   `cytoscape.warnings()` builds, but v3's mostly-no-throw stance
   (a throw can crash an app where ignoring is recoverable) against
   v4's fail-loudly design needs real thought — options like
   disable-all-warnings and demote-recoverable-errors-to-warnings are
   on the table.  Round 40 is that sitting.
9. **The docs site**: the generated v4 site replaces `documentation/`
   at the root at release; v3's docs stay reachable through the
   existing versioned-docs mechanism (rounds 44–45).

Process note: at the maintainer's instruction this sitting lands as a
**PLAN.md-only** edit — decisions and plans, no implementation.  The
README true-up that the docs-travel rule would normally pair with it
is round 37's docs-first commit.

## Round 37 plan — governance close-out (planned 2026-08-04)

Small and first, because the gates protect every round after it.  All
calls already taken (fifth sitting); nothing here needs design.

- [x] **37.1 The two new gates** (2026-08-04) — landed.  Throw coverage
  is a zero-tolerance gate: `gateFailures()` turns an `audit()` result
  into the build's failures, the CLI exits nonzero on any, and
  `npm run test:throws` joins the `npm test` chain after `test:modules`
  (it re-runs the root Node suite under coverage, so it cannot live
  *inside* that suite — the one structural difference from the JSDoc
  gates).  `@returns` ratchets at 276/276 in
  `test/gpu-jsdoc-coverage.mjs`, beside `@throws` and `@param`.
  **`UNREACHABLE`/`MISATTRIBUTED` are now checked, not just written.**
  The promotion to "maintained allowlist" is a real mechanism rather
  than a change of tone: an entry that no longer names a `throw new`
  line, or whose reason is empty, fails the gate on its own.  Zero
  tolerance is only as good as its escape hatch, and this one is keyed
  by `file:line` — round 34 already moved a site out from under its
  entry by inserting two methods above it, and under a gate that
  failure mode does not merely lose a site, it *grants the exemption to
  a different throw* while reading as a pass.
  Controls (the 31.2 pattern), each staged and asserted to fail: a
  Node-reachable site with no spec (1 failure, naming it), an allowlist
  entry pointing at a line with no throw on it, and an entry with a
  blank reason.  Two more hold the gates against the real sources — the
  allowlist validation runs in the fast module suite against a report
  that says nothing (every site unknown, so only the exemptions can
  fail), and the `@returns` gate was run once with a tag deleted from
  `viewport.mts`, failing both its checks (the miss and the 276 floor).
  The CLI's exit code was checked end to end against a hand-written
  lcov marking one real site dead: exit 1.
- [x] **37.2 The alias split** (2026-08-04) — landed.
  `roundrectangle` throws, joining `cutrectangle`/`concavehexagon`, and
  its line in `test/gpu-decided-drops.mjs` flips from
  pinning-the-inconsistency to pinning-the-drop.
  **It was accepted in three enums, not one**, which the call's
  wording did not say and the code did: the node `shape` table,
  `parseLayerShape` (`overlay-shape`/`underlay-shape`) and
  `TEXT_BG_SHAPES` (`text-background-shape`).  Dropping it from
  `shape` alone would have moved the inconsistency rather than closed
  it, so all three go, with a spec per enum.  A third spec pins a free
  consequence worth having: the `shape` error lists the accepted
  keywords from the table itself, so it stops advertising the dropped
  spelling to the v3 user who is reading it to find the replacement.
  `debug/webgpu`'s v3-fixture sanitizer learns the new spelling too.
  `autolockNodes`/`autoungrabifyNodes` stay wired and pinned, and the
  alias table's comment changes from "an open call, recorded beside
  the `roundrectangle` one" to the reason they are kept.  Both
  documents' legacy-alias lines now carry the two-name exception, so
  code and ledger agree for the first time since 2026-07-29.
  **One line deleted from `style.mts` broke three specs elsewhere**, and
  fixing it properly was worth the detour: `test/modules/gpu-throw-coverage.
  mjs`'s fixture named real throw sites by hardcoded line number
  (`874`, `1031`, `1074`), so deleting the `roundrectangle` row shifted
  every one of them by one.  The fixture now *resolves* its lines from
  the sources by anchor text.  It is the round-34 lesson arriving in a
  third place — after the `UNREACHABLE` allowlist it broke then, and the
  gate 37.1 built to catch that — and the same fix applies: a `file:line`
  written down is a claim that nothing above it will ever move.
- [x] **37.3 Constructor options, closed at the type layer**
  (2026-08-04) — landed.  The options type needed no tightening: it
  carries no index signature, so TypeScript's excess-property check
  already rejects every case.  Four `@ts-expect-error` directives in
  `typescript/tests/gpu.test-d.ts` pin it — `motionBlur`,
  `hideEdgesOnViewport`, a plain typo, and one through the named
  `CytoscapeGpuOptions` type — and the control ran: swapping one for a
  *valid* key (`zoom`) makes the directive unused and fails the build,
  so the check discriminates rather than passing vacuously.
  The runtime half is pinned too, which the plan did not ask for and
  the decision needs: three Node specs assert that the dropped
  canvas-era options are ignored, that a typo round-trips through
  `options()`, and — the contrast the whole decision rests on — that
  the names v4 *interprets* still throw.  The ctor's and the factory's
  JSDoc record the asymmetry, including its boundary: excess-property
  checking applies to object literals, so options assembled into a
  variable first widen and pass.
  **The item turned up a third instance of round 36's audit-scope
  failure**, and closing it was in scope because this round is the one
  that gates these audits.  Writing the factory's doc comment meant
  reading it, which showed `cytoscapeGpu` had no `@param` — and yet
  `@param` reported 229/229.  `src/gpu/index.mts` has been listed in
  `PUBLIC_API` since round 26 and contributed **zero** members to
  *every* audit, because the exported-function pattern round 36 added
  matches `export function` and `export const f =` but not
  `export default function`.  So the package's entry point — the most
  public member in the tree — sat outside coverage, `@param`,
  `@returns` and `@throws` while its file read as audited and
  complete, and all three of its tags were in fact missing.  Widened,
  written, and pinned by a spec that fails if the file ever again
  contributes nothing: **17/17, 230/230, 277/277**.
  Round 32 walked class bodies only; round 36 widened to exported
  functions; this widens again.  Same lesson each time — an audit's
  scope is part of its claim.
- [x] **37.4 Event-name openness, documented** (2026-08-04) — landed,
  and it **corrected this file**.  `GpuCore#on`, `GpuCore#emit` and
  `GpuCollection#on` now state the contract: any name registers, custom
  events are supported API (which is *why* no name can be gated), and a
  name v4 never emits registers cleanly and then silently never fires —
  so port event names from the vocabulary rather than by trying them.
  No denylist, no runtime change.
  Three specs pin it, because a documented contract nothing asserts is
  one that comes back by accident, and writing them is what turned up
  the correction.
  **Namespaces do not behave as this file recorded.**  Contradiction 11
  said `cy.on('tap.ns', h)` "never fires, not for `tap` and not for
  `tap.ns` either", and the README said the shared emitter keeps
  namespace parsing "only for v3".  Measured: v4 imports v3's emitter,
  so namespaces parse and work in **full v3 semantics** —
  `on('tap.ns')` listens for `tap` qualified by `.ns`, `emit('tap.ns')`
  runs both it and any plain `tap` listener, `emit('tap.other')` runs
  only the plain one, `off('tap.ns')` removes it.  The narrower true
  statement is that **v4 never emits a qualified name**, so a
  namespaced listener sees application emits and never a library event
  (a `data` write reaches a `'data'` listener and not a `'data.ns'`
  one).  Both documents corrected; the spec asserts each row of the
  table above, so round 41 — which removes the machinery — will have to
  change a test that describes what the machinery actually did.
  The original claim was probably taken from v4's *own* events only,
  which is the sense in which it read true; it is a good example of why
  "measured 2026-08-03" in a record still deserves re-measuring when a
  round leans on it.
- [x] **37.5 Closing docs sweep** (2026-08-04) — landed, carrying the
  README true-up the fifth sitting deferred.
  The README gains a round-37 paragraph and the sitting's own summary
  in its header; the follow-up hooks' round-28 entry, which listed
  every open call as open, now records each decision and the round that
  executes it; the JSDoc section carries the two new gates, the widened
  audit and the corrected tallies; the events section and the
  `Events: no namespaces` paragraph carry the namespace correction; a
  new decided-design bullet states the type-layer-versus-runtime
  strictness split; and the legacy-alias line carries its two-name
  exception.
  This file gains the round-37 paragraph in "Suggested sequencing" (one
  of the three sites the standing rule names), the pass records above,
  the four closed items in "Open calls for the maintainer", the
  namespace correction in contradiction 11 **and** in round 41's plan,
  and the alias closure in the decided-drops ledger.  "Needs a call"
  and "Gaps with direction already set" were checked by name: the
  sitting had already annotated the one live entry
  (`border-style`/`outline-style` → round 38) and the rest are history.
  `AGENTS.md` gains the two gates in the places that asserted the
  opposite — "it reports, it does not gate" and "`@returns` …
  **reported rather than gated**" were both false the moment 37.1
  landed — and its audit-scope note gains round 37.3's third instance.

**Verification (2026-08-04)**: typecheck, lint, **2675 Node tests**, 102
module tests, **172 browser specs** (97 `webgpu` + 75 `webgpu-visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` and `test:types:gpu` clean (37
type exports, 3 statics, 1097 doc blocks), JSDoc coverage 100%/100%,
`@throws` **17/17**, `@param` **230/230**, `@returns` **277/277**,
stranded blocks **1** (the module header, by judgement), and the
now-gating `gpu-throw-coverage` green at **176 run / 10 browser-only /
5 unreachable / 0 Node-reachable dead**.
The two new gates were each run once in the failing direction, which is
the only way to know a gate is a gate: a deleted `@returns` fails both
of its checks, a staged dead throw site exits 1, a stale allowlist entry
and a reasonless one each fail, and a valid key in place of an
`@ts-expect-error` fails the typecheck as an unused directive.
**Round 37 is complete.**

**Risks tracked**: `npm test` now runs the root Node suite twice (once
plainly, once under coverage for the throw gate), which is the cost of
measuring a suite's coverage from outside it — worth watching if CI wall
time becomes a complaint, and cheap to split into a separate job.  The
throw gate's zero tolerance sits on top of allowlists whose staleness the
gate now checks but whose *judgement* it cannot: an entry that is
honestly wrong ("no caller can reach this" when one can) reads exactly
like one that is right, which is why each carries prose rather than a
flag.  And `roundrectangle` is the round's one behaviour change — a v3
stylesheet using it now throws where it silently worked, which is the
intended failure but is the sort of thing a migration guide has to carry
(round 46).

## Round 38 plan — `border-style` / `outline-style`, full coverage (planned 2026-08-04)

The last unported v3 style pair, at the scope the sitting chose:
**every shape**.  The technique has been settled since 27.8; this
round builds all three tiers.

- **The perimeter coordinate**, per tier: closed-form for
  circle/rectangle/round-rectangle (walk the sides + corner arcs);
  angle-parameterized ellipse — arc length is elliptic, so dashes
  space unevenly on eccentric ellipses (recorded deviation);
  the polygon family (sharp polygons, the round-* family, `barrel`,
  `cut-rectangle`, the custom `polygon`) via the SDF loop also
  tracking the argmin edge and its clamped projection against a
  per-fragment cumulative perimeter — roughly 2× polygon fragment
  cost *where a dash is enabled*, accepted; solid borders pay a
  branch only (the `u`-computed-only-when-dashed gate).
- **`double`** — described here as a second inner band, which
  **2026-08-04's scoping found is not what v3 does**: v3 re-strokes at
  `borderWidth / 3` under `destination-out`, erasing a middle stripe
  from the fill and everything under the node rather than filling it.
  See the three sub-calls added to open-call 1; this one, the missing
  `border-dash-pattern`/`-offset` props, and `border-cap`/`-join` are
  the round's docs-first agenda.  **`outline-style`** reuses the
  perimeter at the ring radius (offset perimeter, different arc
  length) and needs no props — v3 hardcodes `[4, 2]` and `[1, 1]`
  there.  `text-border-style` stays out unless the same machinery
  makes it free (call at docs-first).
- Both props enum channels with the standard parse/mapper/
  stored-truth-readback plumbing; ghost bodies carry their border
  style like everything else.
- **Verification is the round-27 discipline**: goldens per tier plus
  **live v3 parity diffs per tier**, each run once with the feature
  disabled to prove it can fail; dash-phase parity checked explicitly
  (v3 launches patterns at a defined origin per shape — read v3
  source before asserting).  A `benchmark/gpu/` row prices the
  dashed-polygon fragment premium on the renderer bench (device
  time, dashed vs solid on the same scene).

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
  edge per frame since the first cull pass.  Curved edges take the
  conservative-then-exact shape: the memoized exact bb rejects, and only
  a survivor walks the flattened path at the drawn subdivision.
  **The `elementsInBox` call, taken**: the public query stays pure
  containment and gains no options argument.  The mode is an
  *interaction* preference, so it should not move a programmatic
  caller's results, and the four-numbers signature is a known footgun
  (33.5) that a fifth parameter would deepen.  Both gesture paths —
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
  Costs (`benchmark/gpu/spatial.mjs`, N=2000/4000 edges, a band over
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
  which is why they can.  `GpuColumnarElements` gains an optional `data`,
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
  `test/gpu-decided-drops.mjs` had a spec asserting `cy.gc === undefined`
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
module tests, **173 browser specs** (98 `webgpu` + 75 `webgpu-visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` clean and `test:types:gpu` at 38
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
release note has to carry (round 46).  And `boxSelectionMode` is a core
option where v3's equivalent is a per-element style prop, so an app
wanting per-element box behaviour has no port path — logged here rather
than in the round record, since it is the shape the sitting chose.

## Round 40 plan — the error policy + `cytoscape.warnings()` (planned 2026-08-04; sitting required)

The one question the fifth sitting deliberately kept open.  v4 fails
loudly by decided design — 191 throw sites are public contract, gated
since round 37 — while v3 mostly avoided throwing because an exception
can crash an app in a case that is recoverable by ignoring it.  The
maintainer wants real design here, not a quick answer.

**Questions the sitting takes** (docs-first carries them with a
proposal to react to):

1. **A two-tier taxonomy** — *contract errors* (programmer mistakes:
   unknown props/keys/options, invalid arguments, malformed payloads —
   always throw) vs *recoverable runtime conditions* (a failed image
   fetch, a full glyph atlas, a deferred compact — today's warn
   sites).  Which of the 191 sites sits in which tier is the sitting's
   real work; `scripts/gpu-throw-coverage.mjs` enumerates them, so the
   review is a pass over a list that already exists.
2. **`cytoscape.warnings()`'s shape** — boolean toggle
   (`warnings(false)` silences the warn tier, v3's surface), or an
   options form (`warnings({ demoteErrors: true })` / an
   `errorPolicy` ctor option) that demotes *recoverable-tier* throws
   to warnings — never the contract tier, or the fail-loudly design
   dissolves.  Global vs per-instance is part of the same call.
3. **What a demoted error does** — return value conventions for a
   call that would have thrown (no-op + warn?  the v3 behaviour per
   site?), and whether the `error` event carries them.

Implementation follows the sitting inside the same round; the
throw-coverage gate's classification lists absorb any re-tiering, and
every site whose behaviour changes keeps a spec for both policies.

## Round 41 plan — the v4 Event + emitter (planned 2026-08-04)

Prerequisite for round 42: v4's one remaining shared-module dependency
on v3 is `src/emitter.mts` (and the shared `Event` object with it).

**Landed 2026-08-04, except one item that turned into a call.**  Two of
this plan's premises were wrong, and both were wrong in the same way —
they stated a fact about the code that nobody had measured:

- **"v4's *one* remaining shared-module dependency"** is five: after the
  emitter and event object were severed, `src/gpu` still imports
  `src/math.mjs`, `src/types.mjs`, `src/util/colors.mjs`,
  `src/util/position.mjs` and `src/util/sort.mjs`.  They are a different
  kind of dependency — generic utilities, no v3 model or renderer types
  in their signatures — so the restructure may keep them shared rather
  than duplicate them, but that is round 42's call and it now has the
  list.  `test/modules/gpu-import-graph.mjs` is the audit, with the five
  as a maintained allowlist on 37.1's terms: a new edge fails, and so
  does an entry nothing imports any more.
- **`preventDefault()` could not be enumerated from v3** — see open call
  12.  v3 never reads `isDefaultPrevented` either, so there is nothing
  to port and the list is a v4 contract to design.  The DOM half of the
  item landed (below); the gesture half is logged.

- [x] **41.1 The v4 Event** (2026-08-04) — `src/gpu/event.mts`.  Typed
  `target` (the core or a one-element collection, so a handler narrows
  with a type guard instead of a cast — 26.5's logged item closes and
  the compile-only consumer test lost its `as`), `originalEvent`,
  `layout`, the derived `renderedPosition`, and **no `namespace` field**.
- [x] **41.2 The v4 emitter** (2026-08-04) — `src/gpu/emitter.mts`, the
  same qualified-listener model with v3's namespace parsing, `bubble`/
  `parent` recursion, `manualCallback` and function-in-qualifier-position
  shorthand all gone (v4 used none of them).  Kept deliberately, because
  behaviour depends on each: the listener snapshot at emit time, the
  copy-on-`off`-during-emit, `one` removing before the callback runs, and
  a handler returning `false` meaning `stopPropagation()`.
  One recorded difference from v3, and it is a fix: v3 snapshots the
  listener list once per `emit()` *call*, so in `emit( 'a b' )` a handler
  for `a` that calls `off( 'b' )` does not stop `b` firing.  v4 snapshots
  per event.
  **The swap is behaviour-neutral by measurement**: the whole Node suite
  passed unchanged except one spec — the namespace one round 37.4 had
  just written to pin v3's semantics, which is the single behaviour this
  round intends to change.  It is rewritten to assert the new contract
  (a dotted name is one literal type), so the removal is pinned rather
  than merely done.
- [x] **41.3 The import-graph audit** (2026-08-04) — above; five specs,
  controlled by adding an outward import and watching it fail.
- [x] **41.4 `originalEvent`, populated** (2026-08-04) — the pointer
  layer attaches the DOM event it is handling to everything it emits.
  Set in the one `listen()` wrapper rather than at ~25 emit sites, so
  the two cannot drift; cleared in a `finally`, which is what keeps it
  honest — an emit from a *timer* (taphold, onetap) has no DOM event
  behind it and reports none rather than the last one seen.  A `webgpu`
  spec asserts the DOM event's own coordinates reach the handler (so it
  is *this* event, not a retained earlier one) and that
  `preventDefault()` sets `defaultPrevented` on it; the control pins
  `domEvent` to null and the spec fails.
- [ ] **41.5 Functional `preventDefault()` for gesture defaults** — not
  built; the enumeration is open call 12.
- [x] **41.6 Docs + declarations** (2026-08-04) — `GpuEvent`,
  `GpuEventProps`, `GpuEventTarget` and `EventHandler` are exported from
  the entry point, so a consumer can type a handler; `dist/
  cytoscape-gpu.d.ts` regenerated (42 type exports, 1147 doc blocks).
  Both documents carry the removal, including the two JSDoc paragraphs
  round 37.4 had *just* written to describe the old behaviour — a
  reminder that a docs fix has a shelf life when the code is about to
  move under it.

**Verification (2026-08-04)**: typecheck, lint, **2696 Node tests**, 107
module tests, **174 browser specs** (99 `webgpu` + 75 `webgpu-visual`)
against a hand-rebuilt bundle with goldens byte-stable and parity scenes
at their recorded values, `test:types` clean, `test:types:gpu` at 42 type
exports / 3 statics / 1147 doc blocks, JSDoc 100%/100%, `@throws` 18/18,
`@param` 231/231, `@returns` 278/278, and the throw gate green at 0
Node-reachable dead over 192 sites.
Controls: the import audit run with an outward import added (fails), the
`originalEvent` spec run with `domEvent` pinned to null (fails), and the
emitter swap itself measured against the whole suite — which is the
strongest of the three, since a behaviour-neutral claim is exactly what a
2696-test suite can check.
**Round 41 is complete except 41.5**, which is open call 12.

**Risks tracked**: the emitter is new code on the hottest shared path in
the library, and "the suite passes" is evidence rather than proof — the
snapshot/`one`/`off`-during-emit semantics are the fiddly part and are
carried by existing specs rather than new ones written for them.  The
per-event listener snapshot is a deliberate divergence from v3 in an
edge case nobody has asked about, so it could equally be a surprise.  And
`originalEvent` now retains a DOM event for the life of any event object a
handler keeps — harmless for the pointer events it comes from, but worth
remembering if an app stores events.

- **A v4 Event class**: typed `target` (core/collection), `cy`,
  positions; **no namespace fields or parsing anywhere**;
  `originalEvent` populated by the pointer layer (the DOM event
  reaches handlers at last); **`preventDefault()` functional** —
  docs-first enumerates the preventable gesture defaults from
  v3-source reading (candidates: tap-selection/-clear, grab
  initiation, box start, cxt menu suppression is already
  unconditional) and each preventable default gains a spec proving
  both directions.
- **A v4 emitter** replacing the `src/emitter.mts` import — the same
  ref/predicate-qualified listener model the core already uses, with
  the namespace machinery gone.  Note what round 37.4 measured: it is
  **live, not unexercised** — v4 emits only unqualified names, but a
  hand-emitted `'tap.ns'` runs the qualified listener and the plain one
  exactly as in v3, and `off('tap.ns')` removes it.  So this is a
  behaviour removal with existing specs to update (in
  `test/gpu-decided-drops.mjs`), not a dead-code deletion.  An
  audit pass confirms no other `src/gpu` import reaches outside
  `src/gpu` (the restructure's precondition, asserted by a spec that
  walks the import graph).
- Ships in `dist/cytoscape-gpu.d.ts`: `event.target: unknown`
  resolved, the compile-only consumer test extended (handlers narrow
  no more).  26.5's logged item closes.
- Bubbling, phase order, `stopPropagation`, and the round-14.5 specs
  carry over byte-for-byte — the event *semantics* do not change,
  only the object and its module.

## Round 42 plan — the great restructure (planned 2026-08-04)

The packaging decision, executed: **v4 becomes the package**.

- **`v3/` is created as a self-contained subproject**: v3's `src/`,
  its tests, `documentation/`, the top-level v3 benchmark suites, the
  v3 debug pages, the v3 rolldown/dts configs, and the stale
  hand-written root `index.d.ts` — everything v3-specific — with its
  own scripts so it builds and tests like a separate project.  The
  parity harness (`playwright-page/parity.html`) and comparison
  benchmarks build v3's UMD bundle from `v3/`; nothing v3-specific
  remains outside the directory.
- **`src/gpu/*` promotes to `src/`** (the `.mjs`-specifier convention
  keeps import edits mechanical); `test/gpu-*`, `test/modules/*`,
  `benchmark/gpu/`, `playwright-*`, `scripts/gpu-*`, `debug/webgpu/`,
  the rolldown/tsconfig/audit configs all re-point.  Whether the
  `gpu-` file-name prefixes stay (history) or drop (tidiness) is a
  docs-first call — the audits' file lists change either way.
- **Root `package.json` becomes `cytoscape@4.0.0-unstable`** (round
  49 settles the prerelease spelling): v4 is `main`/`module`/`types`
  and `exports["."]`; the `./gpu` subpath stays as a deprecated alias
  through the prerelease line and is removed at 4.0 (confirm at
  docs-first).  CI workflows re-point.
- **Behaviour-neutral by assertion**: the full verification gate runs
  green before and after — Node, module, all browser projects with
  **goldens byte-stable**, types, the five audits, a benchmark smoke —
  because a restructure that changes pixels or numbers has done
  something else.

## Round 43 plan — packaging + publish hardening (planned 2026-08-04)

The gaps the 2026-08-04 infrastructure pass found, closed for the v4
entries.

- The dist pipeline produces (and, per the existing release
  convention, commits at release) the v4 **esm/umd/min** bundles —
  today `exports["./gpu"]` points at `dist/cytoscape-gpu.esm.mjs`,
  which is not committed, so a git/npm install resolves to a missing
  file; and no minified v4 bundle exists at all.  The exports map
  gains the UMD/min conditions consumers need (unpkg/jsdelivr fields
  included).
- **A pack-contents spec**: `npm pack` is audited by a test — no
  `PLAN.md`/`AGENTS.md`/`CLAUDE.md`, no playwright dirs, no `v3/`
  internals beyond what is decided to ship, `src/` in or out decided
  deliberately; `.npmignore` → `files` migration if that is cleaner
  to keep honest.
- An **exports-resolution test covering every subpath** (the current
  `test:types:exports` checks only the v3 d.ts and never validates
  the map itself); the root `README.md` rewritten for v4; an explicit
  engines / browserslist / WebGPU-requirements statement (headless
  needs no GPU; a container requires WebGPU — the README rule,
  stated where installers read).

## Round 44 plan — the docs generator (planned 2026-08-04)

Round 26's deliberately deferred half, now due: the release docs are
*generated* from the JSDoc the gates have kept complete.

- The generator reads the source doc blocks and the
  `// -- <group> --` banners (kept accurate since round 26 for
  exactly this) and emits docmaker's `fns` shape —
  `{ name, descr, formats: [ { descr, args: [ { name, descr } ] } ] }`
  — grouped into the banner sections, for the v4 docmaker config.
  `@param` order and overload blocks map to `formats`; `@throws`
  and deviations prose ride the descriptions.
- **Validated, not trusted**: a gate cross-checks generator output
  against the shipped d.ts surface (the `test:types:docs`
  precedent — every public member appears exactly once, no phantom
  entries), and the stranded-block report runs before every
  generation, since a displaced block would now ship twice.

## Round 45 plan — the v4 docs site (planned 2026-08-04)

- Prose sections written by hand (the generator covers members, not
  narrative): introduction, getting started, loading (columnar + the
  wire format), styling with mappers and the sheet, events + the
  interaction surface, layouts + the extension contract, animations +
  transitions, performance.  Demos ported to v4.
- The docmaker template updated for the v4 config; the generated site
  lands at root `documentation/`; v3's site (now `v3/documentation/`)
  is archived through the existing versioned-docs mechanism
  (`versions.json`), so old links keep resolving; the Pages deploy in
  the release workflows re-points.

## Round 46 plan — the migration guide + CHANGELOG (planned 2026-08-04)

- **The v3 → v4 guide**, built in part *from* the decided-design
  ledger and the README's deviations lists (which have been kept
  current for exactly this): selector strings → query objects +
  predicates (a recipe table per selector form), classes → `data()` +
  mappers, style functions → `case`/scale mappers, the animation
  queue → promises, the event vocabulary (what fires, what never
  will), removed patterns (`restore`/`clone`/json-import), dropped
  props with their replacements, and the behavioural deviations an
  upgrading app might trip on (draw order, `elements()` order,
  Float32 positions).
- `CHANGELOG.md` started (4.0.0-alpha onward); both feed the docs
  site.

## Round 47 plan — robustness + soak (planned 2026-08-04)

The tier of testing a release needs and feature rounds never owed.

- **Leak gates**: create/destroy and mount/unmount cycles with
  bounded heap deltas; image-registry, glyph-atlas and listener leak
  specs; the round-11 sliding-window churn scenario promoted from a
  measurement to a pass/fail soak spec.
- **Failure injection**: device loss under load (mid-animation,
  mid-export, mid-force-run); wire-format fuzzing — a malformed
  buffer never crashes, it throws the contract error; limit edges
  (the 256-layer cap, a full atlas, the export texture cap) each
  behave as documented.
- **Multi-instance isolation** (shared page, independent stores,
  destroy order).

## Round 48 plan — cross-platform validation (planned 2026-08-04)

- The matrix, run and recorded: macOS/Metal (the goldens'
  cross-platform claim re-verified), Windows/D3D12, WebKit and
  Firefox WebGPU status with a soft-skip audit (a skip is recorded,
  never silent), real-device touch (Android Chrome — the round-20
  gestures on actual fingers).  Per-platform goldens remain the
  reserve escape hatch if CI disagrees.
- Standing rule applied: no "blocked, no adapter here" conclusion
  without probing from a served page — the mistake this file has
  corrected twice.

## Round 49 plan — release engineering (planned 2026-08-04)

- The release workflows adapted for the 4.x line: version scripts
  (the prerelease spelling settled here), `pre_release_test.sh`
  updated for the v4 artifacts + v4 docs deploy, npm publish (+
  provenance) verified against round 43's pack spec, the blog /
  announcement draft.
- **Cut `4.0.0-alpha.1`** — the first published v4.

## Round 50 plan — the release bake → 4.0.0 (planned 2026-08-04)

- The alpha/beta cycle: external-consumer smoke (a framework-wrapped
  app, an external layout through the round-17 contract, a real graph
  app ported using round 46's guide — the guide is *tested* by the
  port), an issue-triage window, the final benchmark publication, and
  the final docs/ledger sweep.
- Then **4.0.0**.
