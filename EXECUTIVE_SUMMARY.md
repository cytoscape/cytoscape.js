# Cytoscape.js v4 — executive summary

A week-by-week summary of the v4 rewrite: the columnar model and WebGPU
renderer specified in [#3486](https://github.com/cytoscape/cytoscape.js/issues/3486).

**This is a derived document.** The development record is
[`PLAN.md`](PLAN.md), which carries every round's plan, what it found, and the
controls that proved it. This file is the readable-in-five-minutes version and
is rewritten from that record — see *Maintaining this file* at the end.

- **Scope**: the v4 prototype, which begins **2026-07-22**. The `v4` branch also
  carries earlier v3-era work (a TypeScript migration through June and
  mid-July) that `PLAN.md` does not cover and this summary does not describe.
- **Status**: not released. `cytoscape@3` remains the shipping library.
- **Last updated**: 2026-08-08, covering work through round 57 plus the
  out-of-order rounds 52 (shader minification) and 54 (the compound-fit
  bounds), which landed last.

---

## Where it stands

v4 covers its own documented scope and is being hardened. The public API keeps
v3's *shape* — `cy.add()`, `eles.filter()`, `node.position()`, the traversal and
algorithm surfaces — while several v3 mechanisms were removed by decision rather
than reimplemented, each recorded with its rationale.

**It is not close to a release, and the round list is not a plan for getting
there.** The rounds named below are the ones that have been *written down*;
several more are known to be needed and are not logged yet, and four of the
rounds that have shipped (43, 46.5, 55, 56) were inserted after the sequence
they interrupt was already planned. Rounds 55 and 56 are the pattern to expect:
both began with a maintainer opening a page and seeing something no test could,
and both found more than they set out to fix. Treat "what remains" below as an
inventory, not an estimate.

Continuous integration is green as of 2026-08-06, having been red on every push
for several weeks; `npm test` passes from a clean checkout.

| | |
|---|---|
| Automated tests | 2,078 unit · 283 module · 24 soak · 323 browser (220 run; 103 skip for want of a WebGPU adapter, which is the WebKit project) |
| Documented API | 362 members over 48 sections, gated at 100% |
| Visual regression | 45 golden images, compared **exactly** — zero differing pixels · 38 live v3-vs-v4 pixel-parity scenes, five of them **close-ups** at zoom 3–5 · 11 numeric routing-parity scenes comparing geometry rather than pixels |
| Benchmarks | 24 suites; **13× faster than v3** on CPU work, **27×** on rendering (geometric means over 106 and 64 paired rows) |
| Style parity | v4 accepts 153 of v3's 291 style property names; the rest are dropped by decision |
| Bundle | 601 KiB minified, 163 KiB gzipped — ~1.3× v3 (411 / 126 KiB) on the wire, now that the WebGPU shader source (which v3 has no equivalent of, and which a JS minifier cannot touch) is itself minified at build time |

The headline case: a 19,607-node / 464,657-edge network initialises in **1.7 s
against v3's 19.1 s**, and holds **33 ms frames where v3 takes 4,460 ms**.

**Four questions are open**, up from two. The long-standing pair: the
error/warning policy (round 40, its preparatory classification of every error
site approved), and which gesture defaults an event handler may veto (direction
set — explicit toggles come first). Round 56 added two: whether to spend the six
reserved arrow-packing bits on **un-quantizing `arrow-scale`** (which currently
renders 1.4 as 1.375) or keep them for a seventeenth arrow shape, and how to
free the vertex-shader binding that would let **edge labels and the casing
strokes** see the arrow trim.

The unbuilt work that *is* decided — `border-style`, the documentation site,
release engineering — is
scheduled. That list is what has been written down; it is not a complete
account of what 4.0 needs, and round 57 demonstrated as much by adding two
more entries to it in the same week it said so: bringing the per-element
style-override *ergonomics* back through the declarative mapper system, and
splitting the largest implementation files the way the algorithms already
are. Both are logged as directions with what would have to be measured
first, neither is scheduled.

---

## Week 1 — 22–24 July: the foundation

*105 commits. Rounds 1–9.*

The base pass established the architecture and proved it end to end before any
parity work began.

- **A columnar, CPU-canonical model.** Elements live in typed-array columns with
  stable slots, coalesced dirty spans and a CSR adjacency index. Reads stay
  synchronous, so the public API does not become async.
- **A WebGPU renderer** with SDF node shapes, compute culling, indirect draws
  and GPU picking. Text was pulled into scope early, so that labelled rendering
  — the realistic case — could be assessed for performance rather than assumed.
- **A co-signed model↔renderer contract** (`src/contract.mts`) fixing the column
  and flag layout both halves agree on. Changing it is a deliberate, single-file
  act.
- **Selectors replaced by structured queries.** v3's selector *language* is gone;
  v4 takes objects and plain functions. This is the largest single break for
  existing apps and the reason the migration guide leads with it.
- **A serializable mapper DSL** for style, evaluated on the GPU for paint
  channels.

**Decision taken this week**: GPU geometry and the read-staleness contract —
what a synchronous read is allowed to observe while the device is mid-frame.

---

## Week 2 — 27 July – 2 August: parity

*208 commits — the densest week of the project. Rounds 9.4–27, plus four design
sittings.*

The work turned from architecture to matching v3's visible behaviour, and the
measurement infrastructure that makes such claims checkable was built alongside
it.

**Rendering and style parity**
- Curved edges in full: bundled and unbundled bezier, segments, taxi, haystack,
  self-loops, and the endpoint vocabulary.
- Compound nodes: auto-sizing parents, nesting, compound loop edges.
- Background images, multiline labels and label bounding boxes, node charts
  (v3's 101 pie/stripe properties reduced to one data-driven `chart` family).
- Style transitions, animation, and geometry tweens.

**Infrastructure that pays for itself later**
- A **visual regression harness**: golden images plus *live v3-vs-v4 parity
  diffs* rendering both libraries in one run. The distinction matters — goldens
  answer "did this change?", parity answers "is this right?", and an early
  arrow-sizing bug passed the goldens while failing parity.
- **Benchmarks with an HTML report**, and renderer benchmarks driven on a real
  GPU.

**Decisions taken this week** (four sittings)
- **z-index dropped outright** rather than reimplemented.
- The **animation queue removed** — concurrency by channel, promises for
  sequencing.
- **display/visibility split** into a structural tier and a paint-only tier.
- The **event vocabulary and extension contract** fixed, making
  `cy.layout({ impl })` the whole extension story.

---

## Week 3 — 3–8 August: hardening, release preparation, a CI reckoning, and three rounds that began with someone looking at the screen

*Rounds 28–57, and round 52 (numbered out of order — it was scoped late and
landed last).*

With the feature ledger closed, the work moved to what was *unpinned* rather
than unbuilt — contracts, documentation, packaging and robustness.

**Contracts made explicit**
- The **error contract**: every `throw` site the test suite never reached went
  from 34 to 0, and it is now gated at zero tolerance.
- The **documented contract**: `@throws`, `@param` and `@returns` are complete
  and gated, so a doc comment that is silent or wrong about failure fails the
  build. These ship as hover text in the type declarations.

**Performance, measured then fixed**
- A benchmark sweep found five slow paths and **logged rather than fixed** them,
  because a measurement round measures. The next round fixed all five: three
  now sit at parity with v3, style reads went 5.8× → 2.3×, and a per-layout-run
  cost fell from 333 µs to 795 ns.
- Two of those findings were *corrected while being fixed* — one was an artefact
  of the test loader rather than the library. The standing rule that came out of
  it: check a hot-path finding against the built bundle before rewriting
  anything.

**Release preparation**
- **The repository was restructured** so v4 is *the* package at the root and v3
  lives whole and still-buildable in `v3/`. Behaviour-neutral, and verified by
  comparing every moved file against its original rather than by trusting a
  green test suite.
- **Packaging gates**, a **migration guide** whose property tables are measured
  against both libraries rather than remembered, a **generated API reference**,
  and a **soak tier** that found four defects — including a corrupt payload that
  made a load never return, and an identity bug that made `union()` silently
  drop elements across two instances.
- **A status site** (round 46.5): a deployable preview of the branch — the debug
  harness on WebGPU, the benchmark archive with full machine provenance, the API
  reference and the project documents. Its fixtures ship in v4's own binary wire
  format, which is what makes them small enough to host.

**The build that was never green** (rounds 53–53.2)

Continuous integration had been failing on *every* push for weeks, and no one
had read a log — GitHub refuses Actions logs to anyone without repository
admin, so the two failures were diagnosed by reproducing each job in a clean
checkout and confirmed against the real logs afterwards. Both causes were one
line each: a stray type-package reference in v3's TypeScript config that only
resolved because a developer machine has a dependency a runner does not, and a
suite that needed a bundle nothing had built yet.

That is the pattern the whole reckoning turned on. **Every defect found in
these rounds was in something that had never been executed in the
configuration that matters** — a fresh checkout, a runner without a hoisted
dependency, a browser project that could not be launched locally at all. None
were regressions in the library. Among them: a spec suite that had never run
on WebKit and would have failed on its first green run; a spec about rendering
an HTML report that loaded the whole of v3 to read one integer; and a console
warning nobody had seen because that project had never reached the end.

Making it fast then turned up something that is not a CI matter at all.
**v4 compiles its GPU pipelines on first use, not when they are created** —
Dawn returns from pipeline creation immediately and does the work when the
pipeline is first drawn with. Building the whole set at start-up therefore
does not pay for itself; it moves that compilation onto the first frame,
including for every feature the graph does not use. Deferring the eight
feature pipelines until something draws them cut the first frame from **4.6 s
to 2.7 s** on the software renderer, and the same shape holds an order of
magnitude smaller on real hardware. This is first-frame latency for every
consumer, not a test artefact. A companion measurement — that a tween's
pipelines compile on the *first* `animate()`, delaying it by up to a second on
software — is recorded and deliberately not yet acted on.

The browser suite was also made honest rather than merely quieter: nine specs
that asserted something about a running animation by sleeping to a fixed
offset now wait for the state they are named for, which is both stronger and
faster, and the worker count was cut to half the cores after measuring that
one browser per core is the setting that fails. CI now runs as four parallel
jobs — the Node tier plus one per browser project — and `npm test` passes from
a completely clean checkout.

Late in the week a maintainer opened the debug page and reported five
things that looked wrong — segment edges, a taxi edge "breaking in the
middle", arrows not matching v3, hollow arrowheads showing the line
underneath, and semitransparent edges reading as two overlapping shapes.
**None of them were visible to any test**, and the reason was structural
rather than accidental. Every golden image compares v4 against v4's own
previous output, so it can only answer "did this change?". The scenes that
do compare against v3 were too small for the differences in question — a
missing arrowhead gap is about six pixels of line, four hundred times
under the tolerance — and, worse, they deliberately drew *no arrows*, on
the reasoning that arrows were where the two renderers were known to
differ.

The round that followed built the missing instrument: a comparison that
reads both libraries' **routed geometry as numbers** rather than
photographing it, reporting which coordinate on which edge disagrees and
by how much. It also put a floor under the existing pixel scenes — twelve
of them would have passed on two blank images.

Its headline finding is a negative one, and it was worth the round on its
own: **v4's curve routing is correct.** Taxi and segment edges, the two
the maintainer suspected, match v3 exactly — every field, including the
degenerate cases a grid layout produces — as do self-loops, edge bundles
and the bezier families. That removed a whole subsystem from the search
and pointed it at the arrows instead, where the measurements are stark: a
translucent edge diverges from v3 over **27% of the canvas**, and v4 draws
more than twice as much ink as v3 in the hollow-arrowhead scene, because
the line really is visible through every head.

Three defects came out of it, and two were fixed. A rounded taxi edge
between two nodes that share a row or column — which is what a grid
layout produces, and what the maintainer had been looking at — collapsed
to "not a number" internally, which broke the measurement of the whole
graph's extent and so broke *fitting the graph to the screen* for any
diagram containing one. And an edge endpoint accessor reported the centre
of a node where v3 reports its boundary, off by a whole node radius;
applications use that accessor to place their own overlays, so the wrong
answer was visible on screen.

A third measurement turned out not to be a defect at all, and the
explanation is the useful part. v4's box around a compound group is a
pixel tighter per side than v3's — the same pixel whether the nodes have
borders or not, which ruled out the explanation the project had recorded
years of habit around. The pixel is v3 compensating for its own renderer:
v3 caches each element as a texture and composites it through canvas2d,
where antialiasing leaves the true extent uncertain by about that much.
v4 draws the whole scene on the GPU with no per-element textures, so it
has nothing to compensate for. v4's box is simply the correct one, and
that is now recorded as a deviation with its reason rather than as an
open question.

The arrowhead work itself — teaching the renderer to stop the line short
of the head, which is what makes hollow and translucent heads look right
— was designed and measured here and built in the next round.

### Round 56: the arrow gap, and two things nobody had predicted

v3 keeps two shortened points at each end of an edge: the drawn line stops
short of the node by one distance, and the arrowhead's tip sits at another.
v4 had neither, so its line ran all the way to the node's *centre* — visible
through every hollow arrowhead, doubled under every translucent one. Porting
v3's rule took the divergence on those scenes from 11.8% and 26.7% of the
frame to 0.4% and **zero**: a translucent edge with arrowheads is now
pixel-identical to v3.

Reaching zero on the translucent case took a correction from the maintainer.
The first implementation shortened the line further only for *hollow* heads,
a rule picked from an A/B rather than from a principle. Asked why it should
not apply more widely, the principle turned out to be **"does the head hide
the line?"** — an opaque head does, so v3's plain gap is exact; a hollow *or
translucent* head does not, so v3 is relying on its erase and the line has to
be shortened to the head's own depth. Widening the rule that way is better on
every scene at once, which neither blanket answer managed.

Two findings came from **looking at the rendered pixels** rather than reading
the code, which is the round's transferable part:

- A hollow arrowhead is drawn by stroking its outline, so its ink reaches
  outside the shape — furthest at the back corners. v4's arrowhead quad had a
  one-pixel margin, so those corners were being **cut off flat**. That was the
  "clipping" the maintainer had reported, and no amount of reasoning about the
  gap would have found it.
- Six goldens were **cropping their own scene**. The worst lost
  109 pixels of a 300-pixel canvas — and it was the arrowhead golden. Restoring
  it exposed four compound arrowheads that had been listed in the scene since
  August 2nd and never actually drawn, because their style rule was missing.
  Two defects had been concealing each other.
- The golden images **could not see this round's own fix**: eleven moved, by at
  most 0.178% against a half-percent tolerance. That is not bad luck — v3 sizes
  the gap so the line stops *underneath* the head, so an opaque head hides the
  entire difference, and every arrowhead golden used opaque heads. A new golden
  built from hollow and translucent heads moves 1.4% when the fix is degraded
  and 5.3% when it is removed.

The round also inherited four confident statements from its predecessor and
**measurement contradicted all four**, including the recommended way to trim
the line and the assumption that the golden images would catch the change.

To make this kind of thing visible in future, the parity suite gained a
**close-up tier**: short edges viewed at 3–5× magnification, where
anti-aliasing no longer masks geometry, carrying bounds four to twenty times
tighter than the existing scenes.

### Round 57: the cleanup round, and what its own tools could not see

Six items the maintainer asked for, all landed: the repository adopts a
standard code formatter, the two long documents stop opening with a wall of
text and say plainly how far from ready v4 is, the debug harness gains four
networks ported from v3's documentation demos, the deploy build stops warning
about paths it should not, and the default *look* moves onto v3's.

Two of those are worth reading about, because in both cases the interesting
result was a thing a tool found rather than a thing the round built.

**Reformatting the source tree is a free control on every tool that reads it
as text**, and it found four defects. These audits — documentation coverage,
error coverage, the docs generator — each carry an unstated assumption about
how the code is laid out, and reformatting falsifies all of them at once. Five
public members whose parameters happened to wrap across lines were being
**skipped** by a gate reporting 100%; the real surface was 239 members, not
232, and five of them were undocumented behind the gap. Two more audits lost
detection silently for related reasons. And the error-coverage gate had a
**false pass**: a guard no test had ever fired was reading as covered, through
the one measurement blind spot that tool documents about itself. None of this
was caused by the formatter — all of it was hidden by the old layout.

**"Make the default look like v3's" turned out to be a design question, not a
colour change.** Asked what actually differed, the measurement came back
almost empty: v4 and v3 have painted nodes and edges the same grey since the
first week, and 68 of the 72 differing property readings are formatting
(`0` against `0px`). The two real differences were not properties at all — a
*selected* edge in v4 looked exactly like an unselected one, and the flag that
records a *pressed* element had existed for fifty rounds with nothing reading
it. Both are drawn now, and a new side-by-side comparison against v3 covering
selected nodes, a selected compound group, straight and curved selected edges
and their arrowheads reads **zero differing pixels**.

Building it surfaced a divergence, and then the divergence turned out to be
the actual question. In v3 the selection colour is a *default* — any
stylesheet that names its own node colour overrides it, and a styled v3 app
shows no selection colour at all unless it writes its own rule. The first
attempt drew v4's colour inside the shader, where it always won, and recorded
the difference as accepted on the grounds that v4 had no rule an application
could write instead.

That premise was false, which is the useful part. v4 has no selectors, but it
has **conditions**: a style value can already say "this colour when the datum
says so". Making it say "this colour when the element is selected" needed no
new concept at all — and once state is a condition, v3's whole state
vocabulary follows. `:selected`, `:active`, `:locked`, `:grabbed` and the rest
are now conditions an application writes, the affordances v3 gives you for
free are entries in v4's own default stylesheet that any later block replaces,
and the hard-coded highlights came out of the shaders altogether — including a
hover brighten no test had ever covered and no stylesheet could turn off.

Three things make it more than a relocation. A state condition is not tied to
any one property: an element can change *width* when pressed, which a shader
constant could never have allowed, and the bounding box, culling and hit
testing all follow. The affordances are free — a stylesheet made of state
rules would otherwise cost every application a per-element evaluation at load
for a highlight almost nothing is using, so such a sheet resolves to one
answer per state combination (two, for the default) rather than one per
element; a 150,000-element load measures the same either way. And the
*querying* side was brought onto the same list: the stylesheet could style
nine states while a search could match three, so both are now compiled from
one table and cannot drift apart.

Regenerating the reference images for the change turned up something older and
unrelated. **Six of them no longer matched what the library actually drew** —
one by 1.6% of its pixels — because each carried a tolerance granted at some
point for text antialiasing, and that tolerance was wide enough to absorb real
changes for a week without anyone seeing one. The comparison is exact now:
every input that could vary is pinned (the software renderer, the browser
version, the font file, the platform), and measurement across four full runs
confirmed there is nothing left for a tolerance to absorb. The cost of the old
arrangement is worth stating plainly, because it is the general lesson rather
than a detail of this change: nothing was broken, and nobody could have told
from a passing test run whether anything was.

A smaller one, in the same spirit: the specs written for the new demo networks
found a defect on their first run. A helper built its comparison keys in a way
that turned the boolean `true` into the string `"true"`, so every arrowhead
rendered filled where half should have been hollow — twelve identical heads,
entirely plausible on screen, and exactly what the spec was named to catch.

**The bundle-size answer landed** (8 August). The maintainer had asked why
v4's bundle outweighs v3's, and the measured answer was that a quarter of it
was WebGPU shader source, which a JavaScript minifier ships verbatim because
it does not touch string contents. The shaders are now minified at build
time — comments stripped, whitespace collapsed, every interpolation left
byte-for-byte intact — taking the download from 182 to 163 KiB gzipped, a
10% cut for thirty-odd lines of build transform and no new dependency. Most
of the saving is comment prose, which gzip cannot deduplicate the way it
does repetitive code. The gate is the point: the browser now runs shader
text no human wrote, so the change shipped behind the exact-golden pixel
comparison (zero differing pixels across all 45 references), a token-stream
audit of every shader through an independent tokenizer, and the live
v3-parity scenes — plus the planned control, a deliberately naive transform
that must (and does) mangle the fixture the real one preserves.

**The compound-fit bound landed the same day** (round 54). `cy.fit()` had
still been over-framing compound graphs by nearly double, because the
conservative scan grew a disc around each endpoint of a compound-loop edge
sized by the largest node anywhere in the graph, in all four directions —
when the actual geometry only ever extends up and left of the two nodes it
connects. The bound is now directional and per-edge, and the fit zoom on
the reference compound graph went from 0.61 to 0.82. The round's real
finding came from its own verification: a new randomized sweep (sixty
seeded compound graphs, every conservative box must contain the exact one)
failed on its first run — not on the new code's account, but on a
pre-existing hole it was built to find. A taxi edge forced against its
declared direction overshoots both endpoints by its turn distance, which
no size-based margin bounds; the old formulation had covered it only by
the accident of the global margin being oversized. Taxi edges are now
measured exactly rather than estimated, the sweep is a standing test, and
the deliberately-broken controls each fail exactly the specs written for
them.

---

## What remains before 4.0

**This table lists what has been written down.** Several rounds that v4 needs
are not in it because they have not been scoped yet, and four of the rounds
that have already shipped were inserted after this sequence was planned. It is
an inventory, not a schedule.

A design sitting on 2026-08-06 swept the accumulated open decisions: the
`border-style` scope questions were settled (full v3 parity, including the
erase behaviour of double borders; two dash properties port; cap/join are
dropped with the deviation recorded), three surface changes made without a
call were reviewed and ratified, and shader minification moved from
optional to scheduled (it landed two days later — see week 3).

| | needs |
|---|---|
| `arrow-scale` quantization | **a decision.** Arrow scale is stored as a 1/16 step, so `arrow-scale: 1.4` draws at 1.375 — 1.8% small on the head, the gap and the spacing alike. Fixing it spends the six spare bits in the same field, which a seventeenth arrowhead shape also wants. One or the other |
| Arrow trim on labels and casings | **a binding, not a decision.** Two vertex shaders are at the hardware's storage-buffer limit and cannot see the arrow data, so an edge label on an arrowed curve sits ~2.6px from where the API says it should. The fix is to free a slot |
| Hollow *mid* arrows | still show the line: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |
| `border-style` / `outline-style` (round 38) | decided in full — build only |
| Error / warning policy (round 40) | a design sitting; first, every error site is classified into always-throws vs recoverable, so the "demote errors to warnings" option is decided on real numbers |
| Gesture-default veto (`preventDefault()`) | direction set — explicit toggles come first and remain primary; the exact list is designed when that work lands |
| Documentation site (round 46) | prose written by hand; the generated model is ready |
| Cross-platform validation (round 49) | macOS/Metal, Windows/D3D12, real-device touch. WebKit now runs in CI, where it correctly skips: that build exposes no WebGPU |
| Release engineering (round 50) | the release workflows are still v3's and are marked as not yet adapted |
| Release bake (round 51) | alpha/beta cycle, external-consumer smoke, then **4.0.0** |

---

## How this project works, in four habits (and a fifth arriving)

These explain most of what the record contains, and are worth knowing before
reading it.

1. **A control for every claim.** A test is run once with the behaviour it
   checks deliberately broken, to prove it can fail. This has repeatedly caught
   tests that asserted nothing — and on several occasions a control that
   *failed to fail* revealed dead code or a check that discriminated on nothing.
2. **Measure, don't remember.** Statements about the code are re-verified rather
   than inherited. Three consecutive rounds were handed a "fact" from the record
   that had quietly stopped being true.
3. **Decisions are written down when taken**, with their rationale, which is why
   the migration guide could be compiled rather than reconstructed.
4. **Run it where it will actually run.** A suite that passes on the machine
   that wrote it has proved less than it appears: every defect found in the CI
   rounds was in something never executed on a fresh checkout, on a runner, or
   in a browser nobody could launch locally. The habit that follows is to
   reproduce the environment rather than reason about it. The same idea
   explains why three of the last five rounds began with a person opening a
   page: a green suite says the paths that ran are fine and nothing about the
   ones that never did.

A fifth is emerging from the last round and is worth naming: **a change that
should be invisible is the best test of the tools that watch for changes.**
Reformatting every source file could not alter behaviour, and it exposed four
defects in the checks themselves — including one that had been reporting a
guard as tested when nothing had ever run it.

---

## Maintaining this file

**`PLAN.md` is the source; this file is derived from it.** Rewrite this summary
when a round closes — not by appending, but by re-reading the record for the
week in question and restating it.

- **Organise by calendar week**, newest week last, with the commit count and the
  rounds it covers.
- **Translate, do not excerpt.** The audience is a reader who will not open
  `PLAN.md`. Say what changed for users of the library and what was decided;
  leave the implementation, the file names and the round numbering to the record
  itself, except where a round number is the only handle on an open question.
- **Quote numbers only if they are current.** Test tallies, member counts and
  benchmark figures go stale; re-run the relevant command rather than copying a
  figure forward. The commands are in `AGENTS.md`.
- **Keep the open-questions table honest.** An item leaves it when the decision
  is made, not when the work is scheduled.
- Update *Last updated* and the round it covers.

A rewrite that only appends a new week has not been done properly: earlier weeks
routinely need correcting once later rounds reveal what a decision actually
meant.
