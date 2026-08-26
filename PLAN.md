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
**`YYYY-MM-DD-NN-rndRRRR-kind-description.md`** — when it was written, a
counter among the sections sharing that date, the round it is about
(`rnd0000` for the sections that are not rounds) and its kind (`plan`,
`landed` or `note`) — and indexed in **`plan/INDEX.md`** (generated —
`npm run plan:index`).  **The name carries the bookkeeping so the `##`
heading can be a title** (round 108.9): headings read `## Background
images`, not `## Round 15 plan — background images (planned
2026-08-01)`, and the index reads the round, the date and the kind off
the filename rather than parsing them back out of prose.  This file keeps
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

**What happened, and where to read it** (round 108.8).  This file used to
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
  than a blind append to a 1.5 MB one; when a planned round lands,
  rename its file's `plan` field to `landed`.  Run `npm run plan:index`
  after adding or renaming a section, and `test/modules/plan-record.mjs`
  fails the build if the index has drifted — or if a heading has gone
  back to labelling itself with the round, the date or the kind that the
  filename already carries.
- **The closing sweep checks `git worktree list`** (rule added 2026-08-24,
  round 108.4).  An agent worktree left behind after a round is not
  harmless: one abandoned tree under `.claude/worktrees/` put 141 of 278
  files into `npm pack` and turned `test:modules` red, because it holds a
  whole second copy of the repo.  Remove a landed round's worktree when
  the round closes.
- **`EXECUTIVE_SUMMARY.md` is rewritten from the record when a round closes**
  (rule added 2026-08-05, round 46.5).  That file is the five-minute version
  for a reader who will never open the record — organised by calendar week, in
  outcomes and decisions rather than rounds and file names.  It is **derived**:
  the round files stay the source of truth, and nothing is recorded there that
  is not recorded in them first.  Since round 108.8 it is also the record's
  **only** cross-round narrative, so this rule is the single thing keeping that
  history current — a missed rewrite is how the summary this file used to
  carry came to stop at round 64.
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
  z-index was dropped outright.  Those blocks are gone (round 108.8
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

Entries are of three kinds: **contradictions** — places where the code
and this file's own decided-design ledger disagree, usually because an
autonomous round kept or added something the ledger says was dropped —
**new open calls** raised by a round, and **logged ideas**, raised but
not scoped.  Contradictions are logged, never silently patched:
removing public API is the maintainer's call even when a ledger entry
appears to authorize it.

*Scope calls* — work deliberately not done pending a decision — were a
fourth kind, and the subsection is gone because all eight of its entries
had been taken and executed.  **Item numbers are stable identifiers and
are never reused**, so the gaps below are deliberate: a round record
citing "item 12" must keep resolving to item 12.

**As last swept** (2026-08-10, the ninth design sitting), the genuinely
open questions were **items 18, 23 and 27**; every other call this ledger
had raised was taken.  Rounds have landed since without a sweep of this
section, so read that as the last confirmed state rather than as today's.

The sitting-by-sitting history — the fifth through ninth design sittings,
which round executed what, and the running count of open questions after
each — is not repeated here.  It is in the design-sitting records under
`plan/rounds/`, and it was the clearest example of what this file kept
badly: the log that stood here stopped at round 64, and no later round
updated the count it kept restating.  A taken call now leaves this
section, which is what the rule above always said.

### Contradictions between the code and the decided-design ledger

Each was found by reading the code against this file (rounds 28–29's
docs checks), and each is left in place pending the call.

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

### New open calls (sixth sitting, 2026-08-06)

Questions that had been living only in round records — against the
standing rule that every open question surfaces here — plus the
conditional halves of calls the sitting took.  Item 17's condition was
resolved by measurement and its entry has left.

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

51. **Round 86's worker-host deferrals** (logged 2026-08-26, from
    the round-86 landed record — surfaced here per the standing
    rule that a deferral recorded only where it was made is a
    deferral nobody finds).  Three capabilities the worker host
    (`renderer: { worker: true }`) ships without, each correct
    today by falling back rather than failing silently:
    - **Background images in the worker.**  The proxy zeroes the
      image count and emits one loud error event; nothing is
      drawn.  The build-out is `createImageBitmap` decodes in the
      worker with rasters as transferables — the plan's own
      design — plus mirroring the ImageRegistry's entry lifecycle
      across the boundary.
    - **GPU tweens and `startForce` across the boundary.**  The
      animation manager keeps its own main-side rAF clock (no
      sink attaches) so every tween takes the CPU path, and the
      proxy has no `startForce`, so the force layout uses its CPU
      executor.  Both are correct; the cost is exactly the
      per-frame span traffic 86.1 priced (0.086 ms at harness
      scale).  The build-out is a register/unregister sink proxy
      and a force-inputs message.
    - **Page `@font-face` labels in the worker.**  A worker's
      FontFaceSet does not inherit the document's registrations,
      so worker-rasterized labels fall back to system faces (why
      the 86.3 exact-parity scene excludes labels).  Options:
      load faces into the worker's own FontFaceSet from URLs the
      app provides, or raster glyphs main-side and transfer.
    **First measurement**: for images, entry-lifecycle traffic on
    an image-heavy fixture (bytes and messages per second); for
    tweens/force, the span traffic of a real animated session
    under the worker host against the 86.1 numbers; for fonts, a
    worker `FontFaceSet.load` spike proving the face actually
    applies to OffscreenCanvas 2D rasterization in each engine.
