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
- **The kind field is the round's state, for every round** (rule made
  enforceable 2026-08-26, round 111).  Round 111 renamed the 33 rounds
  that had shipped inside a file still named `plan`, merged the five
  pre-108.2 rounds that had a separate plan and landed section into the
  one-file shape, and re-kinded three planning sweeps to `note`.  So the
  rule has no exceptions left, and three gates hold it: a `plan` file may
  not record its own landing (a self-declaration, or a checklist with
  nothing left open), no round may be filed as both a `plan` and a
  `landed` record, and `plan/INDEX.md` publishes the derived state — a
  round is **landed** once a section names it so, its own or one of its
  sub-rounds'.  A round may land with an item held for a call; its file
  says which, and the round is still landed.
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

**As last swept** (2026-09-28, the eleventh design sitting), every open
call in this section has been put to the maintainer one by one and
answered — items 18, 21, 23, 27, 30–48, 50–54, 61–63 and 65–71 each
carry the call on the item, and the answers with their background are in
`plan/rounds/2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`.
The sitting raised **items 72–75** — the arrow-shape review, chart
kinds and their data capacity, gradient stops from data, and built-in
editing affordances — which are open.  Round 131 (the use-case
bundles, landed the same day on the sitting's two calls for it) logged
**items 76 and 77**: the force sim worker's bootstrap failing for the
CJS bundles on Deno, and layouts as a capability.  Round 107
(`cy.patch()`, the id-keyed reconcile, landed the same day on the
sitting's call for it) raised no new item: its one open cost — below
~70% id overlap a reload is cheaper — is a follow-up hook in
`src/README.md`, and its minimap proof moves to round 106 with
`cy.clone()`.  Round 106 (N viewers by cloning, landed the same day)
built it: consumer cursors on the dirty stream, `cy.clone()` with
`follow`, and the minimap in `debug/`; it raised **item 78**, the
viewport animation's double `viewport` event its plan had logged as a
drive-by.  Round 103 (progressive ingest, landed the same day on the
sitting's calls) built `cy.load( asyncIterable )` with `cy.ready` as the
first chunk drawn, after measuring the zero-format baseline at 3× a
monolithic load — nearly all of it cut edges as definitions — and so
added node references to the columnar and wire forms (item 43's first
section under its experimental rule); it raised no new item, and its
open ends (a queued layout, references in `patch()`'s merge mode) are
follow-up hooks in `src/README.md`.  Round 133 (landed the same day on
the sitting's call) took **item 67** and closed it: a whole-sheet
`cy.style()` replace is a sheet diff, with the bypass-clearing rule kept
and the full-pass props left as a follow-up hook; it raised no new
item.  Round 79 (the official JSON schemas, landed the same day on the
sitting's calls — ajv in the tests only, no runtime `validate()`, the
`$id` base left to round 46, the columnar schema held until 4.x,
SchemaStore after 4.0) shipped element, stylesheet, layout and options
schemas as `cytoscape/schemas/*.json`, gated both ways against the
running library; it raised no new item.  Round 75 (the DX polish bundle,
landed the same day on the sitting's calls — `cy.nodeAt` with a
`pickNode` alias, computed headless; `'modifier-zoom'`; `'scrollpan'`;
`viewportCounts()` null headless; the font orphan documented; both
resize declines confirmed) made the container observer emit `resize`,
filtered and belted the web-font re-raster, made collections iterable,
and shipped `cy.nodeAt`, `wheelBehavior` with the page-scroll fix and
`cy.viewportCounts()`; it logged **items 79 and 80**, two findings round
79 recorded in passing (an undeclared force option, and an elements
payload the factory and `cy.add()` disagree on).  Round 88 (the
edge-layer strokes, landed 2026-09-29 on the sitting's call, before the
WebGL implementation) gave the overlay/underlay round caps, round joins
that blend once (capsule steps with per-edge depth, chosen over
equal-depth alone by measurement) and v3's overlay reach over a hollow
head (the gap span — measured, no arrow pass); it **closed item 27**
and logged **item 81**, the same fold in a translucent line's own
strip.  Round 102 (transient emphasis, landed 2026-09-29 on the
sitting's calls — core API, the design by measurement) measured the
app spelling at 2.9 s per hover change on ndex-x-large and a dim that
is a style state at 1.1 s (the O(V) toggle), so it shipped
`cy.emphasize()` / `cy.unemphasize()`: the emphasized set a styleable
state, the rest dimmed by the renderer as a two-tier composite at the
core `dim-opacity` (0.42 ms per change at the 733-degree hub, +0.64 ms
of GPU per frame); it took item 55's measurement note and raised no new
item.  Round 104 (label decluttering, landed 2026-09-29 on the
sitting's calls — off by default, `label-priority` ordering the fade
too) measured the soup first (ndex-x-large: 19,607 labels at fit with
its floor off, 99.4% overlapping) and shipped the core
`label-declutter: 'cull'` and the node prop `label-priority`: a
renderer-local claim over a grid anchored in model space (a pan
re-decides nothing), hysteresis in a rank margin and a one-cell inset
(a slow zoom's strobes 36,703 → 142), 1.66 ms a pass at 19.6k labels,
CPU-only; edge labels stay out, a follow-up hook; it took round 102's
last hook (the emphasized set ranks first) and raised no new item.
Round 134 (landed 2026-09-29 on the sitting's call) took **item 70** and
closed it: the k-clusterings and hierarchical clustering run one
named-metric kernel shared by the in-thread reference and the offload
lane's worker, bit-neutral against the pre-round reference, the closure
path kept for custom metrics; it raised no new item.
Rounds 135 and 136 (landed 2026-09-29 on the sitting's calls) took the
first halves of **items 30 and 31**, which stay open for their later
tiers: 135 counts the style properties no golden sets (75 of 212,
pinned) ahead of the SVG and WebGL parity work, and 136 inventories the
gestures (30; 3 with no coverage at either tier) for the trace tier
before the WebGL implementation; neither raised a new item.  Round 142
(landed the same day on the sitting's call) built that trace tier and
**closed item 31**: ten scripted traces replayed on every v4 host and on
v3, compared as numbers against checked-in records, the WebGL2 backend
one host entry away; it fixed four gesture bugs the traces pinned and
logged **items 88 and 89** (the event orders and targets v3 differs on,
and the edge press that starts on the core).
Round 73 (the WebGL2 fallback, scoped; landed 2026-09-29 on the
sitting's calls — full parity at alpha, the scoping now, the spikes on
the benchmark machine) wrote the feasibility record and planned the
implementation as **round 137**: vertex pulling from data textures
measured free, the compute cull replaced by a vertex-stage collapse
(+0.03–0.33 ms of GPU, no CPU walk), the pick readback no slower than
WebGPU's, and the reach gap fetched (WebGL2 96.4%, WebGPU 85.7% full,
concentrated in Linux, Firefox off Windows and older Safari).  It
**closed item 18** and raised no new item.  Round 100 (the runtime
horizon, landed 2026-09-29 on the sitting's calls — workerd in CI, which
round 131 had already done; the matrix in `src/README.md` now; no React
Native example app) ran the smoke's checks through every candidate and
wrote the support matrix: Tier 1 CI-gated, Tier 2 re-run at release,
Tier 3 recorded with the failing assertion named.  It made the
page-less browser workers a CI gate (`contexts.spec.js`), measured the
edge's CPU budget on real fixtures (a force layout does not fit the
free plan's 10 ms), and found React Native's Hermes, QuickJS-ng and
GraalJS each one `TextDecoder` short of the headless core; it logged
**items 82 and 83** — the worker pool refusing a page-less host, and
Firefox's missing CI project.  Round 138 (landed 2026-09-29 on the
sitting's calls — before alpha, `cy.add()` throws `GpuUnfitError`, the
adapter's limits requested, allocation failures an instance event, the
degradation order item 36 recommended, the soak on the same ledger)
took **items 34, 35 and 36** together and **closed all three**: the
element ceiling moved from 4,194,304 to 16,776,960 per group on the RX
580 (the dispatch's reach, now the limiter), the renderer counts its own
allocations and fires `gpuerror`, degrades labels, then charts and
images, then gradients (lazy now), and a browser soak over its ledger
ran 10,000 cycles flat and found the label shaping memo unbounded; it
raised no new item, logging the two-dimensional dispatch and a catch
around the frame loop as follow-ups in its record.  Round 139 (landed
2026-09-29 on the sitting's call for **item 41**'s alpha part) exposed
the transaction events — `batchstart` / `batchend` around the outermost
batch, `batchend` last, after a patch's summary — and measured the
snapshot price at 100k (`cy.serialize()` 27 ms and 3.07 MB a step,
`cy.patch()` back 18–31 ms); item 41 stays open for the stack, and the
round logged **item 84**, that call put to the maintainer with the
numbers.  Round 140 (landed 2026-09-29 on the sitting's call for
**item 45**) measured that the declaration roll-up keeps generics and
their hover docs in all three shipped declarations, then built
`cytoscape<NodeData, EdgeData>( … )` through `data()`, the collections,
events, payloads, queries and the sheet's field references, untyped
exactly as before without a generic; item 45 is closed, and it raised no
new item — the algorithm and layout callbacks are a deferral in its
record.  Round 141 (landed 2026-09-29 on the sitting's call for
**item 51**) built the worker host's last two deferrals: background
images decode in the worker (the registry mirrored by id, SVG rastered
main-side; a 1,000-raster style apply went from a 124–142 ms long task
to 5 ms) and label fonts come from `renderer.fonts`, registered from
bytes in the worker, exact-zero against the same-thread host — and
found why the spike's url faces "never applied" (Chromium's worker
canvas keeps a description resolved before its face on the fallback,
which the atlas's font epoch now escapes).  WebKit here has no WebGPU,
so it verifies the worker mechanics, not the host.  Item 51 is closed;
the round logged **item 85**, the superlinear data-mapped string write
the spike had priced as decode.  Round 126 (landed 2026-09-29, shader
minification, carrying **item 63**) measured the WGSL-aware minifiers
against the real shaders and kept round 52's shared-fragment
representation — assembling complete modules for miniray or wgslender
grew the full minified bundle by +50 to +61 KB — and shipped what pays
instead: the constant tables inlined at build time (**item 63
closed**), numeric shader constants spliced, float literals shortened
and a `glsl` tag for round 137; the full minified ESM is 10,306 bytes
smaller (3,606 gzipped), and `headless-gpu` stands at 641,040 bytes
against its 600 KB target.  It raised no new item.  Round 76 (the small
style wins, landed 2026-09-29 on the sitting's calls — screen-space
sizing folded into semantic zoom, ledger 23 left, `double` matched as
v3 draws it) shipped `text-border-style` on the label box, re-centred
the box's border on its edge as v3 strokes it (0.384% live parity at
zoom 3, 7.5% with the style ignored), carried in **item 21**'s width
half and **closed item 21**, and priced the gradient path (+0.7–3%
device time at 25k × 50k); it logged **items 86 and 87** — the
`text-transform` readback, and the label box's remaining v3
deviations.  What follows is the sweep before it.

**Swept before that** (2026-09-17, round 127.6), the genuinely open questions
are still **items 18, 23 and 27** — the three the ninth design sitting
(2026-08-10) left open, none of which a round has taken since.  The
2026-09-01 sweep added **item 54**, the benchmark rows the performance
review could not screen; round 116 took item 55's three calls, left
only its round-102 measurement note on the item, and added **item 56**,
the convergence price of size-aware repulsion — **taken by round 117**
the next day (the sim half of `avoidOverlap` is opt-in, on the
measurement the item asked for), which added **item 57**: the settle's
separation hands back more overlap than it finds on the 25k scene —
**taken by round 118.1** on the per-stage measurement the item asked
for (an expansion stage for the crammed case, and a best-state guard;
the measurement is on the round).  Round 119 (2026-09-08) took no
call and raised none: the maintainer's first sitting in front of 118's
page found the GPU force executor's iteration cost, and the round
measured and fixed it (item 54(e)'s rows are re-dated below); round
120 (the same day) gave the smallest components canonical shapes and
the page its EM combo, and raised none either; round 121 (2026-09-09)
took the five follow-ups 120 left — the grouping and the order on the
library, the orientation, the mixed component, the labelled row, the
priced batch — and raised none.  Round 122 (2026-09-09) took **item
49**, the layout portfolio audit: the demand read from the two apps'
repositories, the matrix, the flagships named, the item closed — and
logged **item 58**, component packing on the discrete layouts, the one
gap the audit found — **taken by round 123** the same day, on four
calls the maintainer made at planning.  Round 124 (2026-09-10) took
**item 59**, taxi tracks, on the four calls decided at planning.  The
2026-09-15 sweep added **item 60**, the layout quality audit the
maintainer marked Partial in the feature inventory on 2026-09-14 —
**planned as round 125**, nine sub-rounds each gated on a maintainer
review sitting — **carried out the same day**, every fix on the record
then the first sitting pass the same day: one sub-round signed off,
radial's roots decided and shipped, the rest deferred to the page —
which raised **item 61** (one consistent option surface: spacing,
compacting, the bounding box as hint or constraint) and **item 62**
(AVSDF, reconsidered).  Round 127 (2026-09-15) spelled every string
vocabulary once and logged **item 63** (the bundle price of the
tables) and **item 64** (group names as constants — **taken by round
127.6** two days later, on the maintainer's one-line call).  What the 2026-08-26
sweep changed: item 22's decided action was finally *done* (the comment,
sixteen rounds after the code), item 32's first measurement was taken and
is recorded on the item, and two entries were added for calls that had
been living only in round records — **item 52** (round 109's residual
flake) and **item 53** (the round-90 worktree's unmerged branch, raised
by round 108 and carried in its record alone).  Item 51 had already been
lifted out of round 86's record on 2026-08-26.

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
    **Call taken (2026-09-28, the eleventh sitting): leave it** — the
    1.8% stays a recorded deviation and the span stays reserved.  The
    sitting logged item 72, the arrow-shape review, beside it.  Round
    76 (landed 2026-09-29), whose 76.4 had put this on the table,
    repacked nothing.

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
    **Call taken (2026-09-28, the eleventh sitting): keep v4's `width +
    2 × padding`** as a deliberate deviation, documented in
    `MIGRATING.md` and `features.csv`.
    **Closed by round 88.4 (2026-09-29)**: the deviation is recorded in
    `src/README.md` (the edge-layer paragraph), `MIGRATING.md`
    ("Behaviour to re-check", with the v3-matching padding recipe) and
    `features.csv`'s two padding rows; round 88's close-up parity scenes
    cancel the term (v4's padding is v3's minus half the width), so a
    bound failure there means caps, joins or reach, never the formula.
    The alternative — match v3 for pixel parity — stays one line in the
    round's record; flipping it later is the `width +` term in
    `engine-write.mts`'s layer width derivation.

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
    **Deferred to round 73 (2026-09-28, the eleventh sitting)**: the
    fallback's capability selection decides whether software WebGPU
    adapters go to WebGL2, which has nothing to warm.
    **Closed by round 73 (2026-09-29): not warmed.**  The data the item asked for: Chromium exposes no
    software WebGPU adapter to users (SwiftShader needs
    `--enable-unsafe-webgpu`, CPU adapters are blocklisted,
    `isFallbackAdapter` is "always false on users' devices"), so the
    population is harnesses and CI; and the capability selection
    round 73 designed (`'auto'` takes WebGPU only on a non-fallback
    adapter, else WebGL2) sends a fallback adapter to WebGL2, which
    has no compute stage to warm.  The reach table and the rule are in
    round 73's record; round 137.1 builds the rule.
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
    **Call taken (2026-09-28, the eleventh sitting): `mid-*-arrow-fill`
    excluded, `mid-*-arrow-width` to be implemented.**  Mid arrows stay
    filled (additive later if asked); SVG export and the WebGL path draw
    them filled.
    **Done 2026-09-29 (round 76.5).**  v3 reads an arrow's width only to
    stroke a *hollow* head, so on an always-filled mid head it draws
    nothing in either library: the width ports as a property — parsed
    like the end widths, bypassable, read back resolved against the
    edge width — with no column.  The item is closed.
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
    **Done 2026-08-26**, and the delay is the lesson: the call was taken
    on 2026-08-06 and the one-line edit it authorized sat undone through
    sixteen rounds, because a ledger entry that reads as *decided* is
    read as *finished*.  The comment at `graph-store.mts` now states the
    agreement the two modes do have, the round-56 trim neither accounts
    for, and why the approximation is kept.

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
    **Closed by round 74 (2026-09-18), with one correction.**  The
    gate cleared by four times its bar — 12.2× warm, 7.2× cold at
    n = 2048 on the benchmark machine — and the per-worker clone
    measured 0.21 ms against 0.10 ms for SAB, so SAB is declined with
    the number.  `executor: 'workers'` ships for both betweenness
    forms, unweighted closeness, heatKernel and RWR proximity, and
    `'auto'` takes the pool where the GPU does not run.  The
    correction: **this item's bit-reproducibility claim was wrong for
    betweenness** — contiguous ranges merged in range order group the
    cross-source f64 sums differently from the sequential loop, so
    the pool answers f64-tight numbers that are not the reference's
    bits (measured 5.9e-15 relative).  What contiguous ranges do buy,
    exactly: bit-stability across runs, machines and pool sizes, and
    bit-identity with `'cpu'` for every family whose output element
    is computed whole from one source — closeness, heat and RWR.  The
    round's record derives it; the specs assert bits only there.

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
    **Call taken (2026-09-28, the eleventh sitting): before the SVG and
    WebGL parity work**, tier 1 first.
    **Tier 1 landed by round 135 (2026-09-29); the item stays open for
    tier 2.**  Every golden records the properties its scene sets to a
    non-default value (`playwright-tests/golden-coverage/`, held to the
    scene like the PNG), and `test/modules/golden-coverage.mjs` pins the
    count against the schema's per-group properties that the group
    reads back: **75 of 212 never set by any golden** — 56 paintable
    (the list rounds 77 and 73 are held to; `node --import tsx
    scripts/golden-coverage.mjs --verbose` prints it), 19 no static
    frame can show — and 67 non-default keywords never shown.  Rounds
    102 and 104 landed with no golden (`dim-opacity`, `label-declutter`,
    `label-priority`).  Open: the degrade control.
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
    **Call taken (2026-09-28, the eleventh sitting): the inventory now,
    the trace tier before the WebGL implementation.**
    **The inventory landed by round 136 (2026-09-29).**
    `playwright-tests/lib/gesture-inventory.mjs`
    lists 30 gestures with their gating options, events in order, end
    state and covering specs, held to the tree by
    `test/modules/gesture-inventory.mjs` (every cited title exists,
    every event `src/interact/` emits is listed, the tallies pinned):
    **26 have a browser-level assertion, 1 only headless (one-finger
    touch), 3 none** (pointer-leave, the additive tap, every gesture on
    the worker host).  It names the traces the tier replays and their
    end-state fields; v4 has no grab-and-throw, so that trace pins the
    absence.
    **Closed by round 142 (2026-09-29): the trace tier.**  Ten scripted
    traces (`playwright-tests/lib/gesture-traces.mjs` — the nine plus
    `pointer-leave`) replay through `lib/trace-replay.mjs` on
    `parity.html` and are snapshotted per phase — positions, selection,
    viewport, grabbed and hovered sets, the normalized event log — and
    `gestures.spec.js` holds every v4 host (same-thread, worker; the
    WebGL2 backend is one `HOSTS` entry) to one checked-in record per
    trace, and replays the mouse traces on v3 with every difference a
    keyed, asserted `V3_DIVERGENCES` entry.  Determinism is a delivery
    handshake per pointer step, not a sleep (80/80 at
    `--repeat-each=4`; the file in 31 s).  Of round 136's six
    behaviours four were bugs and are fixed — a second finger's
    takeover now frees the grab (and the whole drag set's flags), a
    right release emits no `tapend` and ends on its press target,
    `dragpan` and `pinchzoom` need both toggles — plus one the v3
    replay found (`tapunselect` on every tap-deselected element); the
    shift box, tap-after-taphold and `scrollzoom` at the clamp are v3's
    and kept.  The inventory reads **30 of 30 with a browser-level
    assertion**.  Logged: **item 88** (the orders and targets v3
    differs on) and **item 89** (an edge press starts on the core).
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
    **Taken 2026-08-26** (`node scripts/bench-coverage.mjs
    --verbose`): **331/394 callable members, 84.0%**, so 63
    uncovered — and the composition says the triage is an afternoon,
    because most of the 63 are not what the item assumed.  Fifty-six
    sit in three files that no benchmark calls *by name* because
    applications do not either: `animation.mts` (29 — `Animation`
    and `AnimationManager` internals: `gpuEligible`, `settleGpu`,
    `demoteGpuAll`, `onCompacted`), `style.mts` (22 — `StyleEngine`
    internals: `applyBulk`, `refreshMapped`, `paintInputs`,
    `arrowBase`), and `event.mts` (3, constructor included).  Every
    one of those is exercised by benchmarks *through* the public
    call that drives it, which is precisely the under-detection the
    script's own header warns about — so they are exemptions with
    reasons, not missing rows.  What is left is small and real: five
    `Collection` members with no benchmark at all
    (`breadthFirstSearch`, `depthFirstSearch`,
    `randomWalkWithRestart`, `heatDiffusion`, plus the constructor),
    `buildColumnar`, `LayoutContext.eles`, and three constructors.
    **So the round is: four algorithm rows, then an exemption list
    with a reason each, then gate at zero** — and the gate's real
    content is the exemption list, which is the part that rots.
    **Proposals (2026-09-18; no implementation yet, on the maintainer's
    instruction).**  Re-taken today: `node scripts/bench-coverage.mjs
    --verbose` reads **333/401 callable members, 83.0%**, 68 uncovered
    (27 fields excluded).  The composition matches the 26 Aug reading
    with the count moved by round 118–127's additions: `animation.mts`
    29 and `style.mts` 22 are internals reached through the public
    calls the benchmarks already drive; `event.mts` 3 (constructor,
    `preventDefault`, `stopPropagation`); `layout/contract.mts` 6
    (`LayoutContext.eles`/`refreshScope`/`nodeDimensions`/
    `packComponents`, `CustomLayout.reheat`, a constructor); `core.mts`
    2 (constructor, `pointerCursors`); `collection.mts` 5 (constructor,
    `breadthFirstSearch`, `depthFirstSearch`, `randomWalkWithRestart`,
    `heatDiffusion`); `columnar.mts` 1 (`buildColumnar`).
    1. **Four algorithm rows, then an exemption list, then gate at
       zero** — as the item says.  The exemption list is a keyed table
       in `bench-coverage.mjs` (`{ member, reason }`), audited the way
       the throw gate audits its entries: a key that no longer names a
       member fails, so the list cannot rot silently.  Reasons come in
       three kinds and the table says which: *reached-through* (an
       internal driven by a benchmarked public call — the 51 in
       animation/style), *not-perf-relevant* (constructors, the event
       methods), *covered-by-suite* (`buildColumnar` is the wire
       suite's subject under another name).  Only `LayoutContext`'s
       four and `CustomLayout.reheat` need a decision: `reheat` is
       118.3's infinite-run API and deserves a row (a reheat's cost is
       a real interaction figure); the context members are reached
       through every layout row.
    2. **A row that discriminates, defined for this audit**: the row
       calls the member by name *and* asserts the property it is named
       for (the round-33 rule) — the coverage script should accept a
       row only when both hold, which means it reads the bench files'
       assertions, not just their call sites.  Cheap to add: the
       script already parses the suites for member names.
    3. **The representative-application tier, proposed separately**:
       coverage says which members are priced, not whether the prices
       add up to what an application pays.  A `workloads` profile
       (standard results shape, promotable by `benchmark:publish`)
       with three or four scripted sessions — load `ndex-x-large`, run
       the flagship layout, select and drag, style a class, export a
       figure; a 10k-node dashboard refresh loop; a 500-node editor
       session with undoable edits — each row a whole session phase
       with its own assertion (the layout converged, the export is the
       golden size).  It is the only place a per-member win can be
       shown *not* to matter, and the one the 86.4 lesson (an
       "obvious" win measuring 0.2 ms) argues for.  It composes with
       round 110's census, which prices the copies these sessions
       pay.
    4. **Gate order**: land 1 (an afternoon), then 2 (a day), then
       gate at zero; 3 is its own round with a plan file.
    **Call taken (2026-09-28, the eleventh sitting): steps 1–2 as a
    small task; the workloads profile during alpha.**
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
    **Call taken (2026-09-28, the eleventh sitting): a one-off probe on
    the style engine**, tooling decided on the result.
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
    **Call taken (2026-09-28, the eleventh sitting): built with items
    35–36**, on the same allocation ledger.
    **Closed by round 138 (2026-09-29)**: `cy.stats().gpu` is the
    renderer's own ledger and `playwright-tests/soak.spec.js` churns it,
    its first spec a leaked buffer that must show to the byte, with five
    device-loss recoveries each rebuilding the same ledger.  **First
    measurement: flat** — 10,000 cycles at 400 / 800 on the RX 580, the
    ledger unchanged from cycle 500 to 10,000; the heap was not, and the
    soak found the label shaping memo unbounded (fixed, two
    generations).  The record:
    `plan/rounds/2026-09-29-05-rnd0138-landed-items-34-36-device-limits-the-degradation-order-and-the-renderer-soak.md`.
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
    **Taken 2026-09-18** (`node benchmark/scale-ceiling.mjs`, RX 580
    through Chromium's hardware adapter, the built UMD, a columnar
    payload built in-page with n = m/4, each size in a fresh browser
    process): **1M and 2M edges render; 5M edges is blank**, and the
    owning subsystem is neither ingest, style apply, the curve blob,
    the atlas, cull nor pick — every one of those completed (5M: init
    4.9 s, ready 1.4 s, first frame 5 ms, `cy.pick()` still answered)
    — it is **the mirror's per-column buffers against the device's
    *default* limits**.  The store's capacity is the next power of two
    ≥ count and the gradient column is 32 B/slot on both groups, so at
    a capacity of 2²³ that one buffer is 256 MiB: allowed by
    `maxBufferSize` (256 MiB) but over `maxStorageBufferBindingSize`
    (128 MiB), the edge bind group is invalid, and the frame's command
    buffer is rejected at `queue.submit` — every frame, silently (item
    36 below).  Bisected exactly: **4,194,304 edges render and
    4,194,305 are blank; the same for nodes** (4,194,304 nodes ×
    100k edges renders at 849 MB, 4.3 s init, 33 ms GPU frame).  With
    labels the ceiling is far lower: 1M labelled nodes at ~8
    characters need a glyph capacity of 2²³ × 64 B = 537 MB, over
    even `maxBufferSize`, so the glyph buffer is invalid and the whole
    frame — not only the labels — is gone; **2,097,152 glyphs** (128
    MiB) is the last capacity that binds, ~260k labelled nodes at
    this label length.  The figures (n = m/4 unless stated):

    | scene | init | ready | VRAM | JS heap | GPU frame | outcome |
    | --- | --: | --: | --: | --: | --: | --- |
    | 250k × 1M | 0.9 s | 0.18 s | 237 MB | 0.42 GB | 12.7 ms | rendered |
    | 500k × 2M | 1.8 s | 0.35 s | 469 MB | 0.88 GB | 13.8 ms | rendered |
    | 1M × 3M | 3.1 s | 0.71 s | 899 MB | 1.49 GB | 23.0 ms | rendered |
    | 1.25M × 5M | 4.9 s | 1.37 s | 1,793 MB | 2.88 GB | — | blank (edge.gradient 256 MiB > 128 MiB binding) |
    | 1M × 3M, labelled | 4.5 s | 0.71 s | 1,470 MB | 1.90 GB | — | blank (glyphs 537 MB > 256 MiB buffer) |

    **The cheapest limiter is one line**: the validation message itself
    says this adapter offers `maxStorageBufferBindingSize` 4 GiB
    (4,294,967,292), and `initGpuContext` (`src/gpu-context.mts`)
    requests no limits at all — requesting the adapter's own
    `maxBufferSize` and `maxStorageBufferBindingSize` at device
    creation (both hosts; the algorithm device in `algo-gpu.mts` too)
    moves the ceiling from 4.19M slots per group to the card's memory,
    where the byte price (item 36: ~164 B per edge slot, ~196 B per
    node slot) puts an 8 GiB card near 40M edges — and the *next*
    ceiling becomes the renderer's V8 heap, which read 2.9 GB at 5M
    edges (~460 B per element on the host, against Chromium's ~4 GB
    default cap), i.e. roughly 8M edges.  **Recommendation: a round
    now, and a short one** — request the limits, add the pre-flight
    item 36 asks for on the same path, pin the boundary with a spec
    that reads `device.limits` rather than a hard-coded count, and
    re-run the probe to publish the new ceiling; the probe is
    `benchmark/scale-ceiling.mjs` (`--sizes n:m,…`, `--price`,
    `--labels`, `--inject`, `--oom`) and stays in the tree for that
    re-run.
    **Note (round 110.3)**: the designed SharedArrayBuffer tier for
    the worker host declares a `maxSlots` ceiling per column and
    refuses growth past it with this item's message; the number it
    defaults to is the one this round measures.
    **Call taken (2026-09-28, the eleventh sitting): before alpha, not
    next, with item 36.**
    **Closed by round 138 (2026-09-29)**: every device requests its
    adapter's limits, and `cy.add()` / `cy.load()` / `cy.patch()` throw
    `GpuUnfitError` before the store changes when a table would outgrow
    them.  Re-run: **16,776,960 elements per group render and one more
    is refused** — 4× the old ceiling, bisected to the element — and the
    limiter is now one dispatch's reach (65,535 × 256), not a buffer;
    ~2M labelled nodes (16,776,960 glyphs a stream), past which labels
    degrade.  The heap was not the next ceiling (6.02 GB at 21M
    elements).  The 110.3 note's `maxSlots` default is this number.
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
    **Taken 2026-09-18** (`node benchmark/scale-ceiling.mjs --inject`
    / `--oom` / `--price`, RX 580, the built UMD).  *What an
    allocation failure does today*: with a 20k × 60k scene rendered,
    the probe made the next mirror reallocation (a `cy.add()` that
    doubled the node capacity) return an invalid `node.position`
    buffer — the exact object WebGPU hands back on out-of-memory — and
    the instance produced **26 uncaptured validation errors in 30
    frames and nothing else**: the `writeBuffer` into the invalid
    buffer, every bind group that binds the column (eight compute
    entries for cull and pick, three vertex entries), the frame's
    command buffer, then `queue.submit` — per frame, forever.  No
    device loss, no exception, no `error` event, `stats().frames`
    keeps counting, `cy.png()` returns a 766-byte blank with a second
    rejected encoder.  The renderer pushes no error scope, listens for
    no `uncapturederror`, and consults `device.limits` nowhere but the
    export pack; the failure is visible only in a devtools console.
    The 5M-edge and 1M-labelled rows of item 35 are the same failure
    reached naturally.  *Real exhaustion could not be provoked on this
    box*: radv spills device memory to system RAM, so 96 fully written
    256 MiB storage buffers — 24 GiB on an 8 GiB card — raised no
    out-of-memory scope, no uncaptured error and no loss, and the
    scene's GPU frame moved 1.41 → 1.83 ms; the one crash seen
    (`OperationError: Instance dropped in popErrorScope`, the GPU
    process gone and every page's device with it) came from an
    earlier variant that hogged from a second device before the scene
    existed, and did not reproduce.  So on Linux/AMD the graceful
    path is a residency cliff, not an error; on D3D12 and integrated
    parts it will be a `GPUOutOfMemoryError`, unmeasured here.  *The
    byte price*, measured as bytes per capacity slot (the three sizes
    agree exactly; capacity is the next power of two ≥ count, so up to
    2× slack): **node 196 B** (gradient 32; outerGeom, ghost,
    borderGeom, borderDash, overlay, underlay 16 each; position, size,
    outerHalf, borderDashMeta 8 each; fillColor, borderColor,
    borderWidth, opacity, shape, imageRef, chartRef, flags 4 each; the
    cull's visible index 4), **edge 164 B** (gradient 32; dashPattern,
    curveParams 16; endpoints, width, arrowWidths, overlay, casing,
    dashMeta, underlay 8; lineColor, opacity, flags, sourceArrow,
    targetArrow, lineStyle, arrowShapes, midSourceArrow, midTargetArrow
    4; two cull indices 4 + 4), **glyph 68 B** (the 64-byte record and
    a cull index) — ~8 glyphs per labelled node here, so a label costs
    ~544 B, 2.8× the node under it.  Fixed: the depth target 4.1 MB at
    1280 × 800, the atlas 1 MB per tier, pick under 0.1 MB, the four
    blobs empty for a plain scene.  Totals 14 / 121 / 899 MB unlabelled
    and 23 / 193 / 1,470 MB labelled at 10k × 30k / 100k × 300k / 1M ×
    3M; host heap after init 20 / 167 / 1,491 MB (1,901 labelled).
    **Recommendation: go, folded into item 35's round, and detection
    before degradation** — (1) an `uncapturederror` listener and an
    `out-of-memory` scope around every realloc so a failed allocation
    becomes an instance event with the column and the byte count, (2)
    a pre-flight of the reallocation size against `device.limits`
    that refuses growth loudly (the `GpuUnfitError` shape from the
    algorithm path) instead of submitting rejected frames, (3) only
    then the degradation order, which the price now settles: labels
    first (the dominant term whenever present), then charts and
    images, then the gradient columns made lazy (32 B of 196 and of
    164, allocated for every scene and used by gradient fills alone).
    **Call taken (2026-09-28, the eleventh sitting): before alpha;
    growth past the device's limits makes `cy.add()` throw**, the store
    unchanged; detection, then the degradation order.
    **Closed by round 138 (2026-09-29)**: an allocation ledger with an
    out-of-memory and a validation scope around every allocation and an
    `uncapturederror` listener, surfacing as the core's `gpuerror`
    event; the pre-flight above; and the order — labels, then charts and
    images (and the curve routes), then the gradient columns, now lazy:
    **node 164 bytes a slot (from 196), edge 132 (from 164)**.  An
    injected refusal is one event and a few rejected frames, then none;
    a refused core column holds the last frame.  Real exhaustion is
    still unprovokable on this box (radv spills), so the
    `GPUOutOfMemoryError` path is exercised by injection only.
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
    **Call taken (2026-09-28, the eleventh sitting): after 4.0.**
    **Revised the same day: excluded — an application
    responsibility.**  Cytoscape draws a figure, and a figure (like
    a PNG) is not itself accessible; keyboard navigation, an ARIA
    description and reduced motion belong to the app, which already
    has the public API (selection, events, `animate` durations) to
    build them.  The item closes.
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
    **Call taken (2026-09-28, the eleventh sitting): CJK designed before
    alpha and built during alpha; RTL/bidi after 4.0**, its dependency
    call taken then.
39. **Lasso selection + public spatial queries** (raised
    2026-08-19).  v3.30 added lasso; v4 has box selection only (no
    `lasso` anywhere in `src/`).  The columns are CPU-canonical and
    the cull/pick tier already answers box and point questions, so
    a polygon-containment query is an extension of what exists, not
    a new index.  Pair it with the API it implies: public spatial
    queries — nearest node, k-nearest, elements-in-polygon —
    beside round 75.4's public sync pick (`cy.nodeAt`), since every
    app that wants lasso wants those next.
    **First measurement**: what `cull.mts`/`cpu-pick.mts` already
    provide toward polygon containment, and the cost of
    point-in-polygon over 100k nodes at a realistic vertex count.
    **Call taken (2026-09-28, the eleventh sitting): in scope, after
    alpha**, additive.
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
    **Call taken (2026-09-28, the eleventh sitting): the full gesture in
    core, after alpha**, its UX informed by the UTokyo Bubble Clusters
    paper (EnrichmentMap's bubbles).
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
    **Call taken (2026-09-28, the eleventh sitting): batch/transaction
    events exposed for alpha, and the snapshot cost measured for
    alpha**; a core undo stack is decided on that number.
    **Alpha part landed by round 139 (2026-09-29)**: `batchstart` /
    `batchend` on the core around the outermost batch — `batchstart`
    before the first mutation, `batchend` last, after the flush and
    after a `patch` summary; no diff, no rollback.  **First
    measurement** (100k elements, i9-9900K): `cy.serialize()` 27 ms and
    3.07 MB a snapshot, `cy.patch()` back 18–31 ms whatever the edit;
    the core's model columns copy in ~1 ms (2.57 MB) but a restore
    rebuilds what a patch rebuilds; an inverse log records a data or
    position op in ≤0.2 µs and a node removal in ~15 µs.  The stack
    itself is the maintainer's call, **item 84**.  The record:
    `plan/rounds/2026-09-29-06-rnd0139-landed-item-41-undo-the-transaction-events-and-the-snapshot-price.md`.
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
    **Call taken (2026-09-28, the eleventh sitting): after alpha.**
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
    **Note (round 110, 2026-09-18)**: the section alignment the
    decoder's zero-copy views rest on is now written on
    `serializeElements` as the encoder's contract; going public
    inherits that sentence as a wire guarantee.
    **Call taken (2026-09-28, the eleventh sitting): public but
    experimental until 4.x** — no cross-version promise at 4.0.
    (Correction to the entry: the format already has a public API —
    `cy.serialize()`, `serializeElements`, `deserializeElements` — and a
    magic/version header with presence flags.)
    Round 103 added the first section under that rule: node references
    (flag bit 2048, a trailing u32 count + packed ids), the version
    still 4.
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
    **Call taken (2026-09-28, the eleventh sitting): declined.**
    Closed.
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
    **Call taken (2026-09-28, the eleventh sitting): prototype, then
    build, before alpha.**
    **Closed by round 140 (2026-09-29)**: the prototype measured that
    rolldown-plugin-dts keeps the generics, their defaults and each
    overload's hover doc in all three shipped declarations (no pipeline
    fix needed), and the build landed — `data()`, group-aware
    collections, events, add/patch/load/clone payloads, queries and
    mapper fields typed; with no generic every type is the untyped one
    (the existing type tests unchanged; never inferred, by `NoInfer`).
    Measured in-round: testing the collection's own shape for `any`
    made a node collection unassignable to a mixed one (a conditional's
    check position measures invariant), so the untyped test reads the
    instance's shapes and a mixed collection reads only shared fields.
    Stops: columnar/wire payloads, the `'data(name)'` string, condition
    values; algorithm and layout callbacks deferred.  The record:
    `plan/rounds/2026-09-29-07-rnd0140-landed-item-45-typed-element-data.md`.
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
    **Call taken (2026-09-28, the eleventh sitting): after alpha, after
    round 107's `patch()`**, with Vue, Solid, Svelte and others
    considered.  `patch()` landed the same day (round 107), so the wrapper's
    prop-diffing has its primitive.
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
    **Call taken (2026-09-28, the eleventh sitting): during alpha.**
    Round 106 built the store/dirty-tracking tap the panel needs: a
    second reader registers its own cursor with
    `GraphStore.registerConsumer()` and cannot starve the renderer.
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
    **Call taken (2026-09-28, the eleventh sitting): a documented SVG →
    PDF recipe, no core PDF.**
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
    *The layered/hierarchical half is taken up by round 112 (the
    `flow` layout — built, not ported); the harness is its pass
    112.1.  Round 114 cleaned up the portfolio that exists — one
    reading of node dimensions, overlap avoidance in every layout,
    locked nodes held everywhere, force's animate made to mean what
    it means elsewhere, and a quality suite over every layout — so
    the audit for the remaining use cases starts from layouts that
    are correct.  **Taken by round 122 (2026-09-09)**: the demand read
    from Cytoscape Web's and EnrichmentMap's repositories at pinned
    commits, the use-case by coverage matrix, and the flagships named
    — `force`, `flow`, `radial`, `circle` / `concentric`, `grid`,
    `preset`, one per use case.  Every use case the apps ship has one;
    the single gap is component packing on the discrete layouts,
    logged as item 58.  A tidy tree, a crossing-minimised or clustered
    circle and any second force layout are declined until an app
    asks; scale is not a use case.  Closed.*
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
    **Call taken (2026-09-28, the eleventh sitting): all ports during
    alpha.**  For navigator the primitive exists since round 106: a
    following `cy.clone()` with its own sheet, proved as `debug/`'s
    minimap.

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
    **Taken 2026-09-18** (`node benchmark/worker-host-deferrals.mjs
    --images` / `--tweens` / `--fonts`, RX 580, Chromium 149, the
    built UMD; WebKit could not launch on this box — Playwright's
    webkit-2336 wants `gstreamer1.0-libav` — so every engine claim
    below is Chromium's, and the WebKit half stays to-verify).
    *Images* (same-thread host, the registry's `acquire` / `release` /
    `takeReady` / `takeFreed` wrapped in-page — the lifecycle a worker
    design mirrors): a 2,000-node load over 200 distinct 64 px
    rasters is **2,000 acquires, 200 decodes, 3.3 MB of rasters, 377
    ms** to settled; a churn that moves 100 nodes per frame between
    urls already live is **5.8k acquires + 5.8k releases per second
    (11.7k lifecycle events/s) and no decodes** — the messages a
    boundary would carry, batchable per frame at ≤100 each way; a
    churn to never-seen urls (50 per frame) is the worst case and
    runs at only **153 restyles/s** because each fresh entry costs the
    main thread ~6.5 ms of `fetch` + `createImageBitmap` — 611
    lifecycle events/s, 2.5 MB/s of rasters, 40 s for 6,000 restyles.
    Vector promotion (500 svg nodes, zoom 0.5 → 4) re-rastered the 20
    visible entries at the 512 tier, 21 MB, 8.7 MB/s.  So the
    boundary traffic is trivial (events in the low thousands per
    second, a url string each) and the decode cost is the whole
    argument: it is main-thread today, it is what the worker host
    exists to move, and the plan's design (decode in the worker,
    rasters never cross) is the right shape — the alternative
    (decode main-side, transfer rasters) keeps the 6.5 ms on the
    thread the host was meant to free.  *Tweens and force* (both
    hosts, ndex-x-large, 19.6k nodes; the census's `postMessage` and
    `writeBuffer` instruments): under the worker host a layout tween
    (`animate: true`, one animation per node) posts **one position
    column per drawn frame, 78 KB at 0.044–0.052 ms/post**, a
    whole-collection opacity tween 38 KB at 0.013 ms/post, and the
    streaming force (`animateLive`) 157 KB at 0.038 ms/post — every
    row under 86.1's 0.086 and beside 110.1's 0.018, 1/20th to 1/50th
    of the 1 ms trigger; the span traffic is not the cost.  The cost
    is the executor: the CPU force at 60 iterations on 465k edges is
    **12.8 s with zero frames drawn** under `animate: true` (the
    silent CPU run is synchronous and holds the main thread the host
    was meant to free — the same-thread host's GPU integrator does the
    same 60 iterations in 1.7 s over 11 frames) and 11.5 s over 21
    frames under `animateLive` against the GPU's 1.4 s.  The tween
    rows also caught the *opposite* asymmetry: the same-thread host
    drew **6 frames in 1.5 s** for the grid layout tween (8 for
    circle) against the worker host's 31 (59) — 156,864 `writeBuffer`
    calls, eight per node animation, so the GPU tween sink's
    per-animation registration is the frame-starver at 19.6k
    animations (logged as item 68; not this item's).  *Fonts*: a
    worker's `FontFaceSet` starts empty (`self.fonts.size` 0 — the
    page's `@font-face` does not inherit, as recorded), and a
    `url()`-sourced `FontFace` added and loaded there reports
    `loaded` and `fonts.check()` true in 2.7 ms **but never reaches
    OffscreenCanvas 2D text** — the advance stays the serif fallback's
    after `load()`, after `fonts.ready` and after a task yield —
    while the same file registered **from an `ArrayBuffer`** applies
    exactly (advance 425.61 = the page's, ink identical).  So the
    build-out is bytes, not urls: fetch the face main-side (or in the
    worker) and register it from its buffer, one message per face;
    the url form is a Chromium dead end for the canvas path, whatever
    `status` says.  **Recommendation, per deferral**: images — go,
    its own sub-round, in the plan's shape (worker-side
    `createImageBitmap`, the registry lifecycle mirrored as per-frame
    lists on the batch; the vector promotion meter runs where the
    columns are, so it moves with the registry); force — go, first,
    because the worker host's CPU force is a 12.8 s freeze where the
    GPU run is 1.7 s, and a `startForce` message plus the settle
    readback is the whole design (the tween sink proxy rides the same
    register/unregister channel); fonts — go, small, bytes-sourced
    faces from an app-provided list (`renderer: { worker: true, fonts:
    [url] }`), with the WebKit half to-verify before the option is
    documented as cross-engine.  The probe is `benchmark/
    worker-host-deferrals.mjs`, rows asserting what they are named
    for (acquire count = restyled count, decodes = frees on the fresh
    churn, one position column per worker frame, the font control
    moving before the face is trusted).
    **The force deferral closed 2026-09-18 (round 129.2)**: `startForce`
    crosses the boundary — the proxy answers a remote runtime, the
    worker's engine runs the integrator it already owns, the state
    and the one readback come back as messages, `stop()` / `cancel()`
    / `destroy()` propagate — and the same probe re-measured the
    worker host's `animate: true` force run at **1.4 s with 24 rAF
    ticks** on the main thread (was 12.8 s and none), the streaming
    run at 1.4 s / 38 ticks (was 11.5 s); the same-thread host reads
    1.75 s / 30 and 1.65 s / 30.  The rows now assert the ticks (a
    held thread warns) rather than the position spans they no longer
    carry.  Images and fonts stay open as recommended above.
    **Call taken (2026-09-28, the eleventh sitting): images and fonts
    both before alpha.**
    **Closed by round 141 (2026-09-29)**: images decode in the worker —
    the canonical registry journals each entry's create and free, the
    batch carries the ops and the worker's registry replays them by id
    and decodes (`fetch` + `createImageBitmap` there; SVG, which no
    engine decodes in a worker, rasters main-side and crosses back
    transferred); a style apply acquiring 1,000 distinct rasters went
    from one 124–142 ms main-thread long task to 5 ms.  Fonts:
    `renderer.fonts` (`{ family, source: url | bytes, …descriptors }`)
    registered from bytes in the worker, round 75's semantics (fallback
    at once, a re-raster when a face the atlas names lands).  Both
    exact-zero against the same-thread host.  Re-measured in-round: the
    url dead end was order, not the source form — a Chromium worker
    canvas keeps a font description resolved before its face on the
    fallback, so a late face re-rasters on a fresh description (the
    atlas's font epoch); and the images' "6.5 ms of decode per fresh
    entry" was the style engine's data-mapped write (item 85).  WebKit
    26.5 launches here but has no WebGPU: it verifies the worker
    mechanics (bytes faces, raster decode), not the host, and the
    option is documented that way.  Tweens stay on the CPU path by the
    item's own measurement.  The record:
    `plan/rounds/2026-09-29-08-rnd0141-landed-item-51-the-worker-hosts-images-and-fonts.md`.

52. **The chain spec's intermittent failure, still unexplained**
    (logged 2026-08-26, round 109).  `test/force-layout.mjs`'s
    *"uncurls a chain"* fails in full-tier runs at a rate around
    one in four (round 108: 2 of 4; round 109: 1 of 3), always at
    **346.45575009003477**, which round 109 identified as exactly
    the `init: 'scatter'` result on that fixture — so in a failing
    run the spectral seed contributes nothing.  What that rules
    out is most of the search space: `spectralSeed` is pure and
    deterministic, reads no global state, and neither it nor the
    sim has a wall-clock or load-dependent term; the two
    hypotheses on file (round 86's invocation shape, round 108's
    load-dependent iteration count) are both falsified by the
    code.  It survives instrumentation-shyly: 0 failures in 20
    probed runs, including 2 under 16 concurrent CPU hogs, with
    every probed run recording byte-identical layout inputs.  The
    spec now prints the diagnosis when it fires (it re-measures
    the scatter path in the failing process and names which of the
    two failures happened), so the next occurrence reports rather
    than puzzles.
    **First measurement**: catch one failing run with a probe
    cheap enough not to move it — the seeded positions before and
    after `spectralSeed`, held in memory and flushed at exit —
    since the inputs are already known to be constant and it is
    the *effect* that goes missing.
    **Seen again 2026-09-18** (round 72's closing `test:node:quiet`,
    1 of 2 runs; the spec file alone then passed 3 of 3): the
    diagnosis printed **355.0107327290165** — "the scatter path
    measures 355.01 in this same process, so the spectral seed did
    not run" — a different constant from the 346.46 on file, so the
    scatter result itself has moved since round 109 (the layout
    rounds since) while the failure's shape has not: the seed's
    effect goes missing, the inputs do not.
    **Taken as a task (2026-09-28, the eleventh sitting)**, not a call:
    it goes with the layout round (items 61 and 62, the round-125 page
    sittings).

53. **The merged round branches** (logged 2026-08-26; raised by
    round 108, which carried it only in its own record).  Round
    108 left open "whether `.claude/worktrees/round-90` and its
    branch are kept — 8 unmerged commits, the maintainer's call".
    **Measured at the sweep: the question has answered itself.**
    No worktree remains (`git worktree list` is one line), and all
    four round branches are fully merged into `v4` —
    `round-90-api-cleanup` (`8b992283`, 0 ahead / 30 behind),
    `feature/round-86-worker-renderer` (`ac2d7d8f`),
    `worktree-plan-round-numbering` (`b87f9812`) and
    `worktree-round-108-agent-ergonomics` (`c4398416`).  Nothing is
    at risk in deleting them and nothing is lost by keeping them,
    so this stays a call rather than a cleanup: `git branch -d` on
    those four names is the whole action, and the tips are written
    here so it is reversible from this file alone.
    **Call taken (2026-09-28, the eleventh sitting): keep all** — the
    eight merged local branches stay.  Closed.

54. **The rows the performance review could not screen** (logged
    2026-09-01, round 113).  The review found no library regression
    across the 43-commit span since 13 Aug, but four movers carry no
    evidence either way and were logged rather than acted on; each is
    a measurement question first.  (a) The renderer's `init: create +
    ready (labels)` on the wrapped-labels scene, a one-shot row: 190 ms
    on 13 Aug, 307 ms and then 224 ms on two readings an hour apart —
    94.1's first-raster atlas work is the candidate, and the row needs
    repeats before it can say whether it moved.  (b) `data · query:
    predicate function`, +19% against its own 17% band, traced through
    the bundle and per commit to noise (45.8–52.5 µs over 43 commits,
    docs commits at both ends); a ~40 ns-per-element row needs the
    `(x32)` amplification to carry evidence.  (c) The algorithms-gpu
    profile's CPU one-shots (affinity propagation n=1024 +27%,
    neighbourhood similarity +22%) with no commit under
    `src/algorithms/` — a `--repeat` for the CPU side alone would
    screen them.  (d) The same profile's GPU side reading 20–52%
    *faster* with no source change: a driver-version line in
    `meta.adapter` would give the next such step a suspect.  (e)
    Added 2026-09-04 (round 117): every render-bench `--layout` row
    recorded before round 116 — round 36's 759–952 ms and round 59's
    1,308 ms on ndex, the 87.2 rows — was a nine-iteration run (116.1's
    readback defect), so the first converged figures are round 116's
    and 117's, and the review's "harness break at 87.2" on those rows
    is a run-length break as well.  Re-dated 2026-09-08 (round 119):
    the GPU executor's per-iteration cost fell 3–7× with the parallel
    cell scan, so rounds 116–118's converged rows are the pre-scan
    figures and the next `--layout` run is the first on the new
    kernel.  Not a
    decision so much as a queue; it leaves this list when a round
    gives those rows bands.
    **Taken (2026-09-28, the eleventh sitting)**: this list is the
    checklist for the next performance review, and leaves the open
    calls.
55. **Round 114's layout follow-ups** (logged 2026-09-02; **the three
    calls taken by round 116, 2026-09-03**).  (a) Size-aware repulsion
    inside the force sim, CPU and WGSL — landed: under `avoidOverlap`
    the sim keeps the settle's own boxes apart through a short-range
    contact term, so a live run streams separated bodies once the
    transient clears; the settle's exact separation stays.  (b)
    `boundingBox` on force — **decided: flow's rule** (scale down,
    never up, bodies held, the drawing centred; held back when a node
    is pinned or constraints are set, as the re-pack is), not v3
    cose's size-blind stretch.  (c) A locked child now stays when its
    compound parent is positioned, shifted or dragged, its subtree with
    it, and the parent re-derives (v3's rule).  What the round found on
    the way: **the GPU force displacement readback had never landed**,
    so every default GPU run stopped at nine iterations — fixed with
    116.1, and every browser force number measured before it is a
    nine-iteration figure.  What remains on this item is a measurement
    the round produced for round 102: the debug page's hover panel is
    the "app spelling today" (a per-element opacity bypass or `hide()`
    over everything outside the closed neighbourhood), timed in the
    console per hover change — the numbers on em-web and ndex-large
    belong in 102's first measurement when that round opens.  **Taken
    by round 102 (2026-09-29)**: on ndex-x-large the bypass costs 2.9 s
    and `hide()` 164 ms per hover change (`benchmark/emphasis.mjs`),
    which is why the dim became the renderer's; the panel now offers
    `cy.emphasize()` beside them, ungated by size.
56. **Size-aware repulsion's convergence price** (logged 2026-09-03,
    round 116; **taken by round 117, 2026-09-04: the sim half is
    opt-in**, `avoidOverlapInSim`).  The contact term kept every pile
    apart in the sim at 1.7–3× the iterations (25k render-bench scene:
    GPU live 15.4 s → 25.5 s, sync CPU settle 44 s → 130 s), and the
    calls were to keep it on, make the sim half opt-in, or change the
    convergence test when boxes are on.  The first measurement decided
    it: the boxed field is never done early (the per-tick max step sits
    at the step cap until alpha ≈ 0.005, so a raised floor freezes a
    bounce — 78 overlaps of up to 10 px on the 200-clique at alpha
    0.02), and on a dense random graph the term does not clear the
    overlap at all (the 1 px gap clamp bounds its push, the spring
    pressure beats it, and the fully annealed 25k × 50k sim holds
    36,042 overlapping pairs that the settle's separation then clears
    exactly as it clears the point sim's).  So the term buys a
    watchable `animateLive` run on a small or clique-heavy graph and
    nothing on the graphs that pay for it; the settle's separation
    stays on by default.  The tables are on the round.
57. **The settle's separation gives out on the 25k scene, and makes it
    worse** (logged 2026-09-04, round 117; **taken by round 118.1,
    2026-09-07: an expansion stage for the crammed case, and a
    best-state guard**).  The calls were whether the dense pass should
    refuse a field it cannot open, whether a global expansion belongs
    above some overlap fraction, and what the budget should scale
    with; the first measurement — the count after each stage — decided
    the first two and made the third moot.  On the sim's 25k random
    field (12 px bodies in 22 px padded boxes, 93% of nodes inside a
    neighbour's box) the sweeps deepened the worst pair from 15.8 px
    to the full box, forty stress rounds took 75,668 pairs to 100,952
    while the bounding box never moved — a stress round is a local
    Jacobi step, and a uniformly dense field's neighbours ask for
    nothing net — and the closing sweeps handed back 69,127 pairs at
    5.68 px mean against 79,373 at 5.82 in.  The local passes alone
    clear crammed random fields of 2k nodes and give out at 3k.  So a
    component of ≥ 1,000 nodes with ≥ 60% touching is scaled about its
    centroid by its median overlapping pair's requirement (≤ 1.25 per
    round) while it stays crammed, the local passes take the residue,
    and the summed overlap depth is measured after every stage with
    the shallowest state restored at the end.  5k, 10k and 25k come
    out with zero overlapping bodies, in 0.2–3 s at 25k, grown
    1.4–1.8× linearly; the 60-clique of labels keeps its 0.45 fill.
    The tables are on the round; the quality suite's crammed 3k row
    and `test/modules/force-separation.mjs` are the gates that were
    missing.
58. **Component packing on the discrete layouts, and a standalone
    re-pack** (logged 2026-09-09, round 122's audit; round 87 had
    logged the same as a "suggested further direction").  The packing
    machinery of rounds 120–121 — shelf pack, the small-component
    shapes, the orientation pass, `componentGroup`, `componentOrder` —
    is reachable only through `force`'s settle and `flow`'s own pass;
    `breadthfirst`, `radial`, `circle`, `concentric` and `grid` place a
    disconnected graph as one body, and the quality suite's component
    rows exclude them by design.  EnrichmentMap vendored a packer and
    lays the singletons out with `grid` for want of this.  The shape:
    `packComponents: true` on the five discrete layouts (run per
    component, shelf-pack the boxes, group and order as force does),
    and a `pack` layout that regroups existing positions with no sim.
    **First measurement**: the quality suite's component fixture
    under each discrete layout with the option on — boxes disjoint,
    the largest component's centre held — and em-web's singleton rows
    from `pack` alone against 121's force-run rows.  **Taken by round
    123 (2026-09-09)**, on the maintainer's four calls: the option is
    `packComponents`, on all five discrete layouts, with the four
    shared spellings; the `pack` layout; breadthfirst's trees as
    blocks on by default (bands, shelves, the singleton block);
    concentric binned per component; locked nodes left out and the
    field kept off them.  The quality suite's packed rows and
    `test/layout-pack.mjs` are the gates; the em-web pictures are on
    the round.  Closed.
59. **Taxi tracks — automatic turn distances per bundle** (raised
    by the maintainer 2026-09-10; **planned as round 124**).  Flow's
    open legibility problem is which edge goes to which node: with
    `curve-style: taxi` every edge out of a rank turns at the same
    distance, so different sources' runs lie on one line.  The
    reference is Abrate's tangled-tree picture (GeneaQuilts with
    curved links), whose universal device is a different turn
    distance per group — in general form, Sander's hyperedge routing
    slots that ELK's orthogonal router assigns per layer gap.  The
    plan: `taxi-turn: auto` takes its turn from a track the curve
    subsystem assigns from live positions (style-side, so edges keep
    routing themselves after a drag and every layout benefits),
    tracks keyed on the source by default (`taxi-track: source |
    target | family`, spelled *track* because *bundle* is the bezier
    pair), the casing drawn per edge in v3's order so a crossing is
    gapped, and flow contributing target-anchored merged corridors
    (112.5's first lever) plus gap growth by track count
    (`edgeSep`).  **First measurement**: a run-overlap column on the
    quality harness and a tracked `flow-taxi` row against the 50 %
    and 20 px rows, on deps, workflow-1k, reactome and the Greek-gods
    genealogy.  The four calls — style-side with a lazy epoch-keyed
    refresh, the `taxi-track` spelling, `source` as the default, the
    casing as parity without a switch — are decided on the round file.
    **Taken by round 124 (2026-09-10)**: the pass as a pure function
    (obstacle-cut bands, ELK's pairwise crossing order — the
    measurement chose it over the staircase on all four fixtures);
    the props with the auto turn delivered through the params
    header's n lane (a new column had no binding in the curved vertex
    stage) and refreshed once per geo epoch from `flushDerived`; the
    casing per edge in v3's order (the parity scene 72 → 10 px); flow's
    merged, target-anchored chains (a corridor probe over 400 seeded
    DAGs: 187 violations → 7) and `edgeSep`; the run-overlap count
    0 / 1 / 0 / 0 on deps, workflow-1k, reactome and the gods.  The
    Greek-gods scene on the page reproduces the reference picture.
    124.7 measured the sweep the plan had estimated at "well under a
    millisecond" — 1.1 s on an 8.7k-edge layered DAG — and cut it to
    8 ms on workflow-1k and 160 ms there (a bitset closure per
    conflict component, capped at 128 bundles; an obstacle index;
    numeric keys).  Closed.
60. **The layout quality audit and iteration — one sub-round per
    layout, each signed off by the maintainer** (raised by the
    maintainer 2026-09-14 as the Partial row in `docs/features.csv`;
    **planned as round 125**, 2026-09-15).  Round 122 audited the
    portfolio and round 123 filled its gap; neither looked at the
    pictures.  The maintainer's clarification: built-in coverage does
    not establish finished quality, and the review is of
    representative app graphs for overlaps, crossings, spacing,
    hierarchy readability, component packing and stability, iterated
    on algorithms and defaults with runtime measured alongside.  The
    plan: nine sub-rounds — 125.1 `force`, 125.2 `flow`, 125.3
    `radial`, 125.4 `breadthfirst`, 125.5 `circle`, 125.6
    `concentric`, 125.7 `grid`, 125.8 `preset` and `random`, 125.9
    packing, 125.10 the debug page as the instrument (a live spacing
    slider, source-coloured edges, an airiness readout) — each with a
    pinned fixture set from the app graphs, a
    measured baseline from the quality suite's probes, the pictures
    from the debug page, the fixes the pictures justify, and **a
    maintainer review sitting recorded on the round file before the
    sub-round counts as landed**.  No new layout; no default changed
    without the sitting; every algorithmic change carries its runtime
    row.  The maintainer's first sitting (2026-09-14/15) opened the
    round with findings on the file: label-inclusive `avoidOverlap`
    broken on force and fighting the N = 4 tidy diamond; the shelf
    packer's row-height waste (EM web's limitation, reproduced); flow
    too spread on reactome and worse with labels, plus a degenerate
    placement; breadthfirst too airy on reactome.  Two levers fall
    out: a measured "too airy" (nearest-box distance over a test-side
    quadtree; distance-to-DAG-parent for flow) and an explicit node
    separation option on the geometric layouts.  **First
    measurement**: the baseline — overlap pairs, crossings,
    edge-length variance, area, the airiness columns, run time — on
    each sub-round's fixtures before anything changes.  Open on the
    round file: where the sittings are recorded, whether 125.8 folds
    into 125.7, whether an accepted default change ships before the
    round lands whole, and the node-separation spelling.
    **Carried out 2026-09-15** (every sub-round on the round file,
    every sitting pending): 125.10 first (the live spacing slider, the
    airiness readout, source-coloured edges, `benchmark:layout-audit`,
    the quality suite's airiness rows), then 125.1 / 125.2 / 125.9 /
    125.4 in parallel worktrees and the rest.  Defects fixed: labels
    measured with a canvas at style time so a layout before the first
    frame separates the boxes the frame draws (the "labels broken"
    finding was the load path); force's tidy shapes sized by the exact
    separation and the sweeps kept within a component; flow's extents
    per side and per direction and a placement pass for free
    singletons (IRAK1 1,632 → 68 px); breadthfirst sized by the pixel
    viewport (nine times airier at zoom 0.11 was the "too airy"
    finding) and a compound parent never a root; the shelf stacks short
    components under earlier columns (em-web 0.66 → 0.83 efficiency);
    preset throws on a half position; random takes a seed; `condense`
    on circle and radial.  Defaults measured and recommended, none
    changed: flow's nodeSep 30 / rankSep 40 and a smaller label gap;
    breadthfirst's need-plus-gap spacing; radial's roots by indegree
    on a directed component, and the rim; condense as a default;
    force's crammed expansion traced per round.  **The first sitting
    pass (2026-09-15, from the desk)**: 125.8 signed off; 125.3's
    roots decided and shipped (a component's true roots, the
    maximum-degree rule as the fallback for a component with none);
    everything else deferred to the page sittings, which wait on the
    page exposing each layout's options (sub-round 125.11); the calls
    on spacing, compacting and the bounding box gathered into **item
    61**, AVSDF reconsidered as **item 62**.  Round-level: sittings
    are recorded on the round file under each sub-round, and an
    accepted default ships as accepted.  125.11 done the same day:
    every layout option on the page, generated from a table the module
    suite holds to the declaration, with the `cy.layout()` call as a
    readout.  **Open on the page sittings.**
61. **One consistent option surface across the layouts: spacing,
    compacting and the bounding box** (raised by the maintainer at
    round 125's first sitting pass, 2026-09-15).  The audit found the
    geometric layouts sizing themselves three ways (grid's `condense`,
    concentric's `minNodeSpacing` rings, circle's and radial's
    box-filling rings grown by `avoidOverlap`), breadthfirst stretching
    every rank to the box, flow spacing by `nodeSep` / `rankSep`, and
    the gap spelled `avoidOverlapPadding`, `minNodeSpacing`,
    `nodeSep` and `componentSpacing` by turns.  The maintainer's
    framing: in v3 the bounding box was a constraint — the result must
    lie inside it unless another option conflicts; in v4 the default
    might read it as a *hint* of the available space that helps a
    layout work better, with an explicit `constrainWithinBounds`-style
    option saying when and how it binds; and options, spacing options
    included, should be generally consistent between the layouts —
    one spelling for the gap, one meaning for compacting, one default.
    Absorbs 125.4's, 125.5's, 125.6's and 125.7's deferred calls and
    round 125's open node-separation spelling.  **First measurement**:
    the option matrix — every layout's spacing, compacting and box
    options with their current semantics in one table — then the
    proposed surface applied to the audit's fixtures through
    `benchmark:layout-audit`, area and gap columns before and after,
    so the sitting decides on pictures and numbers.
    **Call taken (2026-09-28, the eleventh sitting): the bounding box is
    a hint by default**, with an explicit option for when it binds; the
    gap and compacting spellings are decided on the option matrix.
    Scheduled into the layout round with items 52 and 62 and the
    round-125 page sittings.
62. **AVSDF, reconsidered** (raised at round 125's first sitting pass,
    2026-09-15; declined by round 122 "until an app asks").  The
    crossing-minimised ring order.  125.5 measured the clustered
    fixture: the `sort` mapping by cluster cuts crossings 4.3×
    (1,375 → 318) on a 40-node four-cluster graph; AVSDF's adjacent-
    vertex-smallest-degree-first order is the next step on the same
    fixture.  **First measurement**: crossings on that fixture and on
    em-web's giant component under the id order, the `sort` order and
    an AVSDF order computed offline, before any spelling is designed
    (the natural one is a value of `sort`).
    **Call taken (2026-09-28, the eleventh sitting): in the layout
    round**, measured first; a `sort` value only if it clearly wins.
63. **Round 127's bundle price, and whether to inline the tables**
    (logged 2026-09-15, round 127).  Spelling every column id, style
    property name and reserved data key once cost 1.0% of the minified
    bundle and 1.2% gzipped (+8.8 KB / +2.7 KB): the minifier mangles
    `PROP` and `COL` but not `.BACKGROUND_COLOR`, so each reference
    ships longer than the literal it replaced, and the 173-entry table
    ships once besides.  Two ways to take the cost back, both build
    changes the round did not make: a build-time inline of `as const`
    members (a rolldown/oxc transform, if one exists that is not a
    regex), or keeping the tables and accepting the 2.7 KB.  **The
    call**: accept, or schedule the inline as part of round 126's
    minification work, where a shader-string inliner is already on the
    table.
    **Call taken (2026-09-28, the eleventh sitting): folded into round
    126** — inline only through a real (non-regex) transform, otherwise
    accept the 2.7 KB.
    **Closed 2026-09-29 (round 126.5): inlined.**  The transform exists
    — a rolldown plugin on rolldown's own oxc parser
    (`scripts/const-inline.mjs`) — and rewrites `COL.X`, `PROP.X` and
    `TWEEN_COL.X` to their literals at 1,520 sites in the full build;
    the tables no longer ship, and the full minified ESM is 8,908 bytes
    smaller raw and 3,428 gzipped, more than the recorded cost.  The
    scalar constants stay mangled names (rolldown's `inlineConst:
    'all'` measured +3.8 KB raw / −0.7 KB gzip).  The record:
    `plan/rounds/2026-09-15-02-rnd0126-landed-shader-minification.md`.
64. **Group names as constants?** (logged 2026-09-15, round 127;
    **taken by round 127.6, 2026-09-17: yes** — the maintainer's one-
    line answer, and the gate's fourth rule went in the same sitting.)
    `'nodes'` / `'edges'` is the same shape as the three vocabularies
    round 127 made constants, at 718 sites — and 127 had left it
    alone: a two-member typed discriminant reads best as the literal,
    the values are public API (`group: 'nodes'`), and the directive's
    examples did not name them.  The call went the other way;
    `GROUP_NODES` / `GROUP_EDGES` are the spelling and `GroupName`
    derives from them.
65. **The Brandes reference's data layout** (logged 2026-09-18, from
    round 74.1's gate measurement).  The worker body — flat typed
    arrays, an inline indexed heap, predecessor lists as one linked
    pool, weights pre-evaluated into a `Float64Array` — ran the same
    weighted betweenness **2.4–2.7× faster on one thread** than the
    CPU reference in `betweenness-centrality.mts`, which builds a
    `number[][]` of predecessor lists per source and calls the weight
    closure per relaxation (n = 1024 / 2048 / 4096: 449 → 170 ms,
    1912 → 807 ms, 8986 → 3348 ms).  The reference is the
    bit-reproducible spec, so changing its layout changes the
    operation order the parity suite pins and wants its own parity
    record — round 74 logged it rather than took it.  The same body
    already exists (`algo-worker-body.mts`'s `brandesRange`, run over
    `[0, n)`), so the round is small: run it in-thread as the
    reference, re-derive which sums move, and re-pin.  Closeness's
    BFS already went flat in 72.3 for the same reason (84 → 72 ms).
    **First measurement**: the in-thread body against the reference
    at the bench sizes through the built bundle, and the max relative
    difference of the scores — expected 0 (the per-source dependency
    order is the heap's, unchanged) or f64 rounding.
    **Call taken (2026-09-28, the eleventh sitting): go, a small task.**
66. **Edge id registration is a third of a bulk load** (logged
    2026-09-18, from round 110.1's census).  A CPU profile of the
    wire-form init of ndex-x-large puts `registerBulk` →
    `IdIndex.setBulk` at **120 ms of 370** — the 464,657 edges carry no
    ids, so the store generates a string per edge and interns it,
    which is more than the adjacency build, the flags, the data
    column and every column copy together (the copies are 1.4 ms;
    the round was looking for copies and found this).  Two shapes
    to measure: lazy ids for id-less edges (an edge without an id
    is addressed by slot until something asks `id()`, and the
    generated string is minted then — `ele.id()`, `json()`, the
    wire encoder), or a numeric fast path in the index (a generated
    id is `e<n>`; the index could store the counter and format on
    read).  Either must keep the duplicate-id guard exact and the
    `cy.getElementById` contract.  **First measurement**: init with
    ids pre-generated in the payload versus generated at ingest, to
    split the string cost from the interning cost.
    **Call taken (2026-09-28, the eleventh sitting): measure, then the
    numeric fast path**; lazy ids only if that is not enough.
67. **A whole-sheet `cy.style()` re-apply re-derives and re-uploads
    every column** (logged 2026-09-18, from round 110.1's census).
    Sixty re-applies of a sheet whose only change was one node
    `background-color` constant cost **198 ms each** on ndex-x-large,
    of which 22 ms is the 60 MB upload of every dirtied column; the
    rest is the style path recomputing channels that did not change.
    A sheet diff — apply only the properties whose compiled value
    differs from the installed sheet's, per group — would make the
    row read as a one-channel restyle (a mapper refresh, tens of ms).
    Not a copy question; logged here because the census is where the
    number was taken.  **First measurement**: the same sixty applies
    with the diff simulated by hand (`cy.nodes().style(...)` of the
    one property), which is the target.
    **Call taken (2026-09-28, the eleventh sitting): go, before alpha**,
    keeping the bypass-clearing rule of a sheet replace.  It is an
    alpha round because Cytoscape Web depends on it.
    **Closed by round 133 (2026-09-28).**  The first measurement ran as
    asked — headless, the full re-apply 250.9 ms and 59.55 MB of dirty
    columns per apply, the hand diff 70.7 ms and 0.08 MB — and the diff
    beat the target: 1.53 ms and 0.08 MB (an identical sheet 0.06 ms;
    one edge `line-color` 35.5 ms).  In the browser the census row's
    60 replaces went from 12.0 s and 1.79 GB of upload to the frame
    rate and 2.4 MB.  A replace re-writes only the props whose
    declaration changed, per group def, through round 61's narrow
    writers; every bypassed slot takes the full write (the rule is
    kept), and a prop with no narrow writer — size, labels, the edge
    opacity fold — still takes its def through the full pass, which is
    the follow-up hook it leaves.  End-state equivalence with the full
    pass is pinned by `test/sheet-diff.mjs`, with a control per clause.
    Closed.
68. **The GPU tween sink starves the frame at tens of thousands of
    animations** (logged 2026-09-18, from item 51's measurement).  A
    layout with `animate: true` on ndex-x-large creates one position
    animation per node (19,607, `layoutPositions`'s finisher); on the
    same-thread host every one registers with the GPU tween sink, and
    the run drew **6 frames in 1.5 s** for grid and 8 for circle —
    156,864 and 196,080 `writeBuffer` calls, **eight per animation**,
    79–91 ms of upload and the rest of the second in per-animation
    JS — while the worker host, whose animations take the CPU path
    and post one 78 KB position span per frame, drew 31 and 59 frames
    in the same second.  The CPU path is the faster one here by 5–7×,
    which inverts the tween tier's premise at this count.  The fix
    shape is the finisher's, not the sink's: a layout tween is *one*
    animation over a position column (start and end arrays, one
    registration, one upload), which is also what the GPU integrator
    already does for the force settle.  **First measurement**: the
    frame count of the grid tween at 2k / 5k / 10k / 20k nodes on
    both hosts, which finds where the per-animation cost crosses the
    per-frame span cost.
    **Call taken (2026-09-28, the eleventh sitting): go, before alpha**
    — one column animation per layout; per-node observability during the
    tween is settled with it.
69. **The offload lane frees the kernel's share; the builders are
    still in-thread** (logged 2026-09-18, from round 129.4's offload
    rows).  Every offload family builds its snapshot on the calling
    thread — the view, the weights, the CSR from per-node `Set`s — and
    on a sparse graph that build is most of the call once the kernel
    is cheap: at n = 32,768 (mean degree 2.7) pageRank's whole call is
    5.5 ms with 4.0 held, Katz's 12.2 with 4.6, the triangle walk's
    13.6 with 12.5, the census's 45.4 with 27.7, the similarity
    count's 268 with 45.7 — the row that asserts the thread free under
    the lane fails the last two at that size, which is the row doing
    its job.  The lane's crossovers were stamped where the *whole*
    call reaches a quarter frame, so what a caller gets there is the
    kernel off the thread and the build on it.  The fix shape is the
    builders': write the CSR from the view in one pass (no `Set` per
    node — the round-74 snapshot builders do this already), and for
    the wire path (item 43) hand the worker the columnar payload and
    let it build there.  **First measurement**: the build's share of
    each family's call at 8k / 32k / 128k nodes on the sparse fixture,
    which says whether the builders or a worker-side build is the
    round.
    **Call taken (2026-09-28, the eleventh sitting): one-pass
    builders**, the build share measured first.
70. **The k-clusterings and hierarchical clustering have no offload
    lane** (logged 2026-09-18, round 129.1's decision).  Their
    references call the distance per iteration through per-node
    caches (`vecOf`, `makeGetDist`) and accept a custom metric, so
    the maths is not a self-contained kernel over a snapshot, and
    materializing attribute vectors for the *named* metrics would put
    a second implementation beside the closure path — which the
    same-kernel rule forbids.  The honest shape is one kernel over
    materialized vectors that the in-thread reference *also* runs for
    the named-metric case (the closure path kept for custom metrics
    alone), with a parity record for the reference's own change of
    operation order.  Until then `executor: 'workers'` rejects on
    `kMeans`, `kMedoids`, `fuzzyCMeans` and `hierarchicalClustering`,
    and `'auto'` runs them in-thread.  **First measurement**: the
    named-metric share of real calls (the GPU path already requires
    attributes and a named metric, so its parity suite is the
    fixture), and the in-thread run's length at 1k / 5k nodes.
    **Call taken (2026-09-28, the eleventh sitting): build the lane
    before alpha** — one named-metric kernel shared by the reference and
    the workers.
    **Closed by round 134 (2026-09-29).**  The first measurement: 77 of
    the tree's 83 call sites name or default the metric (the six
    custom ones are specs of the custom-function feature), and the
    in-thread runs at 1k / 5k read 11 / 45 ms (k-means), 49 / 2,980
    (k-medoids), 45 / 207 (fuzzy c-means), 26 / 646 (hierarchical).
    `kClusteringKernel` and `hierarchicalKernel`
    (`algo-kernels-cluster.mts`) run over attribute vectors evaluated
    once on the calling thread; the reference runs them for a named
    metric, the closure path keeps a custom function and a per-pair
    linkage in-thread, and an explicit `'workers'` rejects those with
    the reason.  The reference's change is bit-neutral — every digest
    at 1k / 5k identical to the pre-round bundle, and a `===` spec of
    the kernel against the closure path under the same metric as a
    function — and 3–10× faster in-thread.  Crossovers: fuzzy c-means
    and hierarchical 512, k-medoids 768, k-means 4096.  Closed.

71. **Eleven source files still sit at 1,000–1,600 lines after round
    130** (logged 2026-09-20).  Round 130 split the ten largest — the
    class hubs keep their path as a facade and delegate to a sibling
    directory of implementation functions, the two pure-function files
    re-export from theirs — and left these for the maintainer's call:
    `store/curve-index.mts` (1,555), `render/gpu-force.mts` (1,416;
    `gpu/gpu-force.mts` since round 131.1),
    `style-scales.mts` (1,376), `render/mapper-runtime.mts` (1,190),
    `contract.mts` (1,076 — a `test/modules/string-keys.mjs`
    declaration site, so `DECLARED_IN` must follow a split),
    `public-types.mts` (1,064), `algorithms/algo-gpu-cluster.mts`
    (1,057), `algorithms/algo-kernels.mts` (1,045), `render/cull.mts`
    (1,026), `taxi-tracks.mts` (1,022), plus `style/mappable.mts`
    (1,041 — one table, one entry per mapper-capable prop).  The three
    class facades that stayed over 2,000 (`collection.mts` 3,870,
    `graph-store.mts` 2,279, `core.mts` 2,218) are doc comments the
    JSDoc gates read from the class body and ship as hover text; going
    lower means the subclass-chain split the maintainer declined, or
    moving the docs off the class.  The round file lists the large
    non-`src/` files too (the two Playwright specs at 9,579 and 7,425
    lead).
    **Call taken (2026-09-28, the eleventh sitting): leave them as they
    are.**  Closed.

72. **The arrow-shape review** (raised by the maintainer 2026-09-28,
    the eleventh sitting, beside item 23's call).  v4 carries v3's
    twelve heads (`none`, `triangle` with its `arrow` alias, `vee`,
    `chevron`, `circle`, `square`, `diamond`, `tee`, and the compound
    `triangle-tee`, `circle-triangle`, `triangle-cross`,
    `triangle-backcurve`), and the vocabulary may consolidate: the
    maintainer's examples are two near-duplicate compound heads
    becoming one ("`triangle-tee` and triangle-line" — v4 has
    `triangle-tee` and `triangle-cross`, no `triangle-line`) and `tee`
    matching the edge width in v4, with other possibilities open.
    Public style API, so it wants settling before alpha, and before
    SVG export (round 77) and the WebGL path (round 73) each implement
    the heads.  **First measurement**: the head gallery — every shape
    at three widths and both fills, v3 beside v4 — plus the usage of
    each shape in the flagship apps' sheets and v3's issue tracker.
    **Scheduled (2026-09-28, the eleventh sitting): a short sitting
    before round 77**, on a head gallery prepared for it.

73. **Chart kinds and their data capacity** (raised by the maintainer
    2026-09-28, the eleventh sitting, at round 80's slice cap).  The
    cap is one case of a general limit: the chart record packs
    `offset | count << 24`, so every kind carries at most 255 values,
    and per-fragment cost differs by kind — the pie walks its slices
    (O(n)), heat and bar index (O(1)), and a point-series kind (a
    scatter plot may carry far more than 64 points) would want a
    different draw altogether.  The call is a design sitting on which
    chart kinds v4 will ever draw and what capacity the record gives
    them — widening the count field if needed, a documented cap per
    kind by its cost — before round 80 picks the pie cap.  Line and
    scatter are logged, not declined.  **First measurement**: the
    render-bench pair (25k charted nodes, 16 vs 64 slices) round 80.3
    already specifies, plus the record-blob bytes per value.
    **Scheduled (2026-09-28, the eleventh sitting): a short sitting
    before round 80**, on the capacity measurement prepared for it.

74. **Gradient stop lists from element data** (raised 2026-09-28, the
    eleventh sitting, round 76's open question; **TBD** — the
    maintainer asked for further consideration).  `background-fill` /
    `line-fill` stop colours and positions are constants-only (≤ 5
    stops, packed into the 32-byte gradient columns); a `{ data }`
    passthrough would give each element its own gradient.  No app has
    asked.  What to weigh: the gradient columns are per element
    already, so storage does not change; the cost is the style path
    (a per-element list parse and re-pack on data writes, as
    `chart-values` pays) and the interaction with item 36's plan to
    make the gradient columns lazy.
75. **Built-in editing affordances** (raised by the maintainer
    2026-09-28, the eleventh sitting, at round 81's interaction
    scope).  Editing should be more built in: handles on annotations,
    on nodes (resize) and on edges (bend points — v3's `edge-editing`
    extension territory), and in-place label editing.  **Design before
    alpha, build after**: the handle model, its events and gesture
    ownership (the alpha gate's "resolve picking and gesture ownership
    where it affects public events") settled first, so annotations v1
    (round 81) and compound drag-and-drop (item 40) fit it.  Line/arrow
    annotations that track live node positions are decided with it.
    **First measurement**: the inventory of what `edge-editing`,
    `node-resize` and the annotation editors in Cytoscape Web
    implement, against what v4's pointer state machine already owns.

76. **The force sim worker's bootstrap fails for the CJS bundles on
    Deno** (found 2026-09-28 by round 131's local Deno 2.9.6 run;
    pre-existing since 129.3 — reproduced on the pre-round tree).  The
    cross-runtime smoke passes, but for `cytoscape.cjs.js` and both
    slim CJS bundles Deno prints an uncaught worker error, "(m.default
    ?? m).__runForceSimWorker__ is not a function": the bootstrap
    `import()`s the artifact its own URL names, and Deno's view of a
    CJS file through `import()` does not carry the factory's statics
    where the bootstrap looks.  The ESM bundles are unaffected.  The
    smoke asserts values, and the run's values still land, so nothing
    caught it — the smoke should also assert the force worker's stats
    (`__forceWorkerStats__`) where a worker is expected.  **First
    measurement**: what `import()` of a CJS file answers on Deno (and
    Bun) — the namespace's shape — and whether `createRequire` in the
    worker is the portable spelling.

77. **Layouts as a capability** (round 131's open call, left with the
    round by the eleventh sitting).  `core/lifecycle.mts`'s layout name
    switch keeps every layout in every entry — ~118 KB minified — so
    `cytoscape/headless` cannot drop force and flow for an app that
    only runs grid.  A `layouts` table in `CoreCaps` (the seam 131
    built) would let a T0 build register only what it names; the cost
    is that `cy.layout({ name })` for an unregistered name must reject
    naming the build, as the GPU registry's `'gpu'` does.  The same
    open list names the full bundle's levers — round 126's shader
    minification and item 63's constants price — both taken by round
    126 (2026-09-29), which left `headless-gpu` at 641,040 bytes against
    its 600 KB target: the remaining levers are model-side, this item's
    among them.  **First measurement**: the minified bytes per layout in
    the headless build, and which layouts the flagship apps' headless
    paths call.
78. **Viewport animations emit `viewport` twice per tick** (logged by
    round 106's plan as a drive-by, raised to the ledger at its close
    so it is findable).  `_afterAnimationTick` (`src/core/viewport.mts`)
    passes `['pan', 'zoom', 'viewport']` to `Core._emitViewportEvents`,
    which appends `'viewport'` itself, so every animated pan/zoom tick
    fires `viewport` twice — round 106's minimap redraws its extent
    rectangle twice per tick, harmlessly.  The fix is one word; the
    round that makes it adds the listener-census spec (each of `pan`,
    `zoom`, `viewport` once per tick) with the current code as its
    control.
79. **The force layout reads an undeclared `tidyComponents`** (found
    2026-09-28 by round 79's schemas gate, logged by round 75).
    `force-run.mts` honours `options.tidyComponents !== false` (round
    120's canonical small-component shapes), and the internal
    `ForceRunOptions` declares it, but the public `ForceLayoutOptions`
    does not — so TypeScript rejects an option the layout reads, the
    layout-options schema accepts it only because it is open, and the
    debug page's options table cannot list it.  The call: declare it
    (documented, default true) or retire the escape hatch.  **First
    measurement**: whether any spec, benchmark or flagship-app sheet sets
    it `false`.
80. **`options.elements: { nodes: {} }` loads an empty graph; `cy.add()`
    of the same object throws** (found 2026-09-28 by round 79's schemas
    gate, logged by round 75; reproduced on round 75's tree: the factory
    constructs with 0 nodes, `cy.add( { nodes: {} } )` throws
    `nodeDefs is not iterable`).  The bulk path converts through
    `buildColumnar` before `partitionDefs`' iteration can fail, so a
    malformed `{ nodes, edges }` passes silently at construction and
    loudly afterwards.  The schema follows the declared array.  The fix
    is a shape guard on `{ nodes, edges }` that both paths share, with a
    throw spec for each.  **First measurement**: none needed — two
    reproductions and the guard's placement (the one shared partition
    step).
81. **A translucent line (and casing) on a sharp route still folds**
    (logged 2026-09-29 by round 88).  Round 88.2 rebuilt the curved and
    route *layer* strips as capsule steps with per-edge depth, so an
    overlay or underlay composites once with round joins, as v3's
    stroke-once path does.  The line's own strip and the paired casing
    draw keep the mitred quad-per-step strip: past the miter clamp, or
    where a step is shorter than the half-width, adjacent quads overlap
    and a translucent line blends the fold twice, and the outer corner
    is a miter spike where v3 (lineJoin 'round') rounds it.  Measured on
    round 88's tree: black 0.5-opacity width-8 zigzag segments at zoom
    3 read **0.660%** against v3 (spikes and folds together).  The call:
    carry the layer mechanism to the line and casing (the line's pass
    would then write depth too — the early-z bands need re-deriving, and
    dashes ride a longitudinal coordinate the capsule steps do not
    carry), or record it as a deviation.  **First measurement**: split
    the 0.660% into spikes and folds (an opaque line isolates the
    spikes).

82. **The worker pool and the force sim worker refuse a page-less
    browser host** (logged 2026-09-29 by round 100).  Both
    `browserWorkers()` tests (`algorithms/algo-workers.mts:204-220`,
    `layout/force-remote.mts:133-148`) require `document != null`, so a
    model hosted in a dedicated, shared or service worker gets T0 and no
    T1: measured on Chromium 149, Firefox 151 and WebKit 26.5, where a
    dedicated worker has `Worker`, `Blob` and `URL.createObjectURL` and
    still gets "executor 'workers' requires worker threads … a browser
    page with Worker and Blob"; `'auto'` answers on the worker's own
    thread (`contexts.spec.js` asserts the values, not the lane).  The
    check is not arbitrary: Bun and Deno also have `Worker`, `Blob` and
    `createObjectURL`, and must take the `worker_threads` path (Deno
    accepts module workers only), so a `WorkerGlobalScope` test has to
    come after `nodeThreads()` in both files, with specs on each host.
    The loss is parallelism, not responsiveness — the model is already
    off the main thread.  **The call**: open the pool to worker hosts
    (nested workers exist in all three engines), or state the limit in
    the matrix as it stands.
83. **Firefox has no CI project** (logged 2026-09-29 by round 100).
    `ci-browser` runs Chromium and WebKit; Firefox is in no Playwright
    project, so the matrix's Firefox row is Tier 2 on one local run
    (151: the page and all three worker kinds pass the smoke's checks,
    the page's pool too).  Firefox has no WebGPU on Linux (round 73's
    reach table), so on a hosted runner its project could only hold the
    model tier — `algorithms-workers`, `load`, `contexts` — until round
    137's WebGL2 renderer gives it something to draw with.  **The
    call**: add a `headless-firefox` project for those specs now, or
    wait for 137 and add the renderer project whole.
84. **A core undo stack: the call on round 139's number** (logged
    2026-09-29 by round 139, item 41's decision).  v4 now brackets
    every outermost batch with `batchstart` / `batchend`, so an app's
    snapshot undo is four lines — `cy.serialize()` pushed at
    `batchstart`, `cy.patch()` to undo.  At 100k elements (i9-9900K,
    `benchmark/undo-cost.mjs`) that costs **27 ms and 3.07 MB per
    transaction** (every one, a single data write included; ~150 MB for
    50 steps) and **18–31 ms to restore** whatever the edit.  A core
    snapshot stack could take the snapshot ~25× faster (the model
    columns: ~1 ms, 2.57 MB) but not restore faster — a restore
    rebuilds the id map, adjacency, hierarchy and style, which is what
    the patch's 18–31 ms already is.  An inverse-operation log is
    orders of magnitude cheaper per transaction (≤0.2 µs per data or
    position op, ~15 µs per node removal) and costs completeness
    instead: every mutator must record its inverse, and the element
    events carry no old value today.  **The call**: (a) no core stack —
    the events and the documented recipe are v4's undo; (b) a core
    inverse log, old values on the mutation path and an audit that
    every mutator records one; or (c) a core snapshot stack, which the
    number does not favour.
85. **A data write to a string-mapped style key is superlinear in the
    distinct values** (logged 2026-09-29 by round 141, from item 51's
    re-measurement).  Headless, no renderer: `node.data( 'img', url )`
    where the sheet maps `background-image` from `img` costs **0.19 /
    2.4 / 33 ms** per write at 250 / 1,000 / 4,000 distinct urls (one
    shared url: 0.04 ms); a `background-color` mapper over distinct
    strings 0.27 / 0.83 / 4.1 ms.  The profile sits in the style
    engine's partitioned re-apply (`applyPartitioned`,
    `applyBulkEdges`, `writeLabel`, `markPair`), not in the image
    registry — the spike had priced the same cost as 6.5 ms of decode
    per fresh url, and it is equal on both hosts
    (`benchmark/worker-host-deferrals.mjs --image-hosts`, the churn
    row).  **First measurement**: where the per-write work scales with
    the distinct-value count (a partition rebuilt per write?), then the
    fix and a row that holds a 4k-distinct write near the shared-url
    cost.
86. **`text-transform` reads back from the sheet, not the element**
    (logged 2026-09-29 by round 76).  Its reader takes the def's
    constant alone (`src/style/readers-labels.mts`), so a mapped or
    bypassed `text-transform` reads the sheet's value — `'none'` under a
    `case` mapper — while the drawn text is transformed; golden coverage
    inherits it (the `label-boxes` golden draws uppercase and the report
    lists the keyword as never shown).  The label entry stores the
    transformed text, not the transform.  **The fix**: carry the id on
    the entry as `bgShape` and (76.3) `bgBorderStyle` are, and read it
    there; a spec for the mapped and bypassed cases.
87. **The label box's remaining v3 deviations** (logged 2026-09-29 by
    round 76.3's parity scene).  (a) v4 draws the box only when
    `text-background-opacity` > 0, where v3 also strokes a border-only
    box; (b) a `round-rectangle` box keeps v4's auto radius (min(w, h)
    / 4, at most 8 px) where v3's `roundRect` uses 2 px; (c) v3 rounds a
    label's measured width up (`calculateLabelDimensions`), so its box
    can be up to 1 model px wider.  All three are in the migration
    guide's re-check table.  (a) is a cheap fix — the quad condition
    plus the three places the label bounds read the padding; (b) and
    (c) change every round box and every label's width.  **The call**:
    which of the three to match.
88. **Gesture events against v3: the orders and targets the traces
    found** (logged 2026-09-29 by round 142).  The gesture traces
    replay the mouse traces on v3 and list each difference in
    `V3_DIVERGENCES` (`playwright-tests/lib/gesture-traces.mjs`), which
    the spec holds to still differ.  Those that are orders or targets,
    not bugs: (a) **the release order** — v3 emits `tap` and the
    selection events before it frees, and each `-on` variant first
    (`freeon`, `free`, `dragfreeon`, `dragfree`); v4 frees first, plain
    form first, then taps; (b) v3's mouse box unselects the outsiders
    before it emits `box`; v4 emits `box` first; (c) v3's `tapend` goes
    to the element under the release point, v4's to the pressed element
    (the capture's target); (d) v3's `dbltap` fires on any second tap in
    the window, whatever its target — v4 needs the same target, as
    documented; (e) a multiple-select-key press on a node grabs it (and
    the selection) in v3, freed at release or box start; v4 decides box
    mode at the press and grabs nothing; (f) a drag from a locked node
    pans in v4 (round 10's default, `a locked node does not drag; the
    gesture pans instead`) and does nothing in v3; (g) v3 samples its
    first wheel deltas and clamps them while it does, v4 zooms every
    tick by 10^(Δ/500); (h) the fingers a pinch or touch cxt consumes
    get no `pointerup` / `tapend` in v4, where v3 emits `tapend` when
    the last finger lifts.  All in the migration guide's re-check
    table.  (a), (b) and (h) are cheap (the emit order in
    `onPointerUp` / `boxEnd`, a release emit in `endTouch`); (c)–(g) are
    behaviour.  **The call**: which to match; each one matched removes
    its `V3_DIVERGENCES` entry, which the spec then requires.
89. **An edge press starts on the core** (logged 2026-09-29 by round
    142, behaviour 3 of round 136's six).  The press path picks nodes
    synchronously on the CPU and edges through the async GPU pick, so a
    press on an edge emits `pointerdown` and `tapstart` on the **core**;
    the edge takes `pointerup`, `tapend` and `tap` once the pick has
    answered (from the hover pick, or the press's own), and a right
    press never takes an edge at all (`cxttapstart` / `cxttap` on the
    core).  v3 hit-tests edges synchronously and targets the edge from
    the press.  The traces pin both (`tap-select`'s additive phase,
    `cxt-press`'s end).  **Options**: a synchronous CPU edge hit test
    for the press — the routed geometry is CPU-canonical, the box query
    already walks it — or deferring `pointerdown` / `tapstart` until the
    pick answers (a frame of latency on every background press).  The
    WebGL2 backend (round 137) inherits whichever is chosen, since the
    pick seam is shared.
