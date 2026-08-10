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
- **Last updated**: 2026-08-10, as round 62 closed: the maintainer's
  flat goal — every benchmark for v4 should beat v3 — is met, with all
  287 v3-comparative pairs reading v4-faster in the published run (see
  "Where it stands" and week 4).  The fully-specced queue closed 8 August —
  rounds 52 (shader minification), 54 (the compound-fit bounds) and 38
  (border and outline styles) landed, the robustness round finished its
  limit coverage, and the two open questions each gained their prepared
  input — a measured error-site classification and a written
  gesture-veto proposal.  On 9 August the maintainer closed both by
  declining the surface each had priced — errors and warnings stay as
  built, and gesture control stays with the explicit toggles — and the
  arrow trim reached its last three consumers (edge labels, the layer
  strokes, mid arrows), pixel-exact against v3; the force layout was
  rebuilt on what the field ships after the original model was
  measured unstable on real networks; and the status site gained
  cross-commit benchmark comparison, so a performance regression is
  now something the site shows rather than something someone
  remembers — which it demonstrated immediately: under the default
  stylesheet's new selection look, every select was restyling whole
  elements, and bulk selection had quietly gone from 38× faster than
  v3 to ~3× slower.  The same day's follow-up round fixed it (a state
  flip now writes only the channels the flip changes; selection is
  ~8× faster than v3 again); see week 4.  The
  preceding days added a maintainer-driven interaction arc (edges
  activate on press, v3's hit-test halos, pickable arrowheads) and the
  debug harness's move onto the default style, all described under
  week 3.

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
| Automated tests | 2,115 unit · 341 module · 24 soak · 355 browser (240 run; 115 skip for want of a WebGPU adapter, which is the WebKit project) |
| Documented API | 362 members over 48 sections, gated at 100% |
| Visual regression | 46 golden images, compared **exactly** — zero differing pixels · 45 live v3-vs-v4 pixel-parity scenes, seven of them **close-ups** at zoom 3–4 · 11 numeric routing-parity scenes comparing geometry rather than pixels |
| Benchmarks | 24 suites; **every one of the 287 v3-comparative pairs reads v4-faster** as of 10 August (geometric mean **11×**, minimum 1.03×), **27×** on rendering (geometric mean over 64 paired rows) |
| Style parity | v4 accepts 157 of v3's 291 style property names; the rest are dropped by decision |
| Bundle | 617 KiB minified, 166 KiB gzipped — ~1.3× v3 (411 / 126 KiB) on the wire, now that the WebGPU shader source (which v3 has no equivalent of, and which a JS minifier cannot touch) is itself minified at build time |

The headline case: a 19,607-node / 464,657-edge network initialises in **1.7 s
against v3's 19.1 s**, and holds **33 ms frames where v3 takes 4,460 ms**.

**The two long-standing open questions closed on 2026-08-09, each by
declining the surface its own homework had priced.** For the error/warning
policy, classifying all 198 error sites showed only ~11 plausible demotions —
half of them meaningless while there is no fallback renderer — so the decision
is that errors and warnings stay exactly as built, with no `warnings()` toggle
and no demotion machinery. For gesture vetoing, the written proposal's own
toggle map showed every candidate default already has an explicit control, so
`preventDefault()` stays browser-level only and the toggles are the whole
gesture-control story. The other item round 56 raised — freeing the
vertex-shader binding that lets **edge labels and the casing strokes** see the
arrow trim — was never a decision, and landed the same day (week 4). **Three
questions are open**: whether to spend the six reserved arrow-packing bits on
**un-quantizing `arrow-scale`** (which currently renders 1.4 as 1.375) or keep
them for a seventeenth arrow shape; whether v4 keeps its **edge overlay
band width** (`width + 2 × padding`, always visible) or adopts v3's
(`2 × padding`, invisible at small paddings) — a divergence week 4's parity
scenes surfaced; and what `cy.collection( arg )` should do with an argument —
today it silently returns the empty collection where v3 builds from the
argument, a porting trap round 60's own benchmark controls walked into.

The unbuilt work that *is* decided — the documentation site,
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

*201 commits. Rounds 9.4–27, plus four design sittings.*

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

*208 commits — the densest week of the project. Rounds 28–57, closing on
8 August with the out-of-order tail: rounds 52, 54 and 38, the robustness
round's limit tests, and the prepared input for both open questions.*

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
  drop elements across two instances. The robustness round finished on
  2026-08-08 with its three deferred **limit tests**: graphs big enough to
  actually hit the 256-image ceiling, fill the label-glyph atlas, and reach
  the GPU's export-size cap, each proving the library degrades with a single
  warning and keeps running rather than crashing — and that the fix an error
  message recommends actually works when followed.
- **A status site** (round 46.5): a deployable preview of the branch — the debug
  harness on WebGPU, the benchmark archive with full machine provenance, the API
  reference and the project documents. Its fixtures ship in v4's own binary wire
  format, which is what makes them small enough to host. (Since round 60 the
  archive also renders cross-commit comparison pages — see week 4.)

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

The press affordance itself gained its missing half (8 August). Pressing an
edge had activated nothing — hit-testing edges happens on the GPU, a frame
after the press decides everything else — and that had been recorded as an
accepted deviation. The maintainer reframed it: an edge not being draggable
does not make it unclickable, and the highlight is the signifier of the
click. So the press now waits for the asynchronous answer: an edge under it
takes the highlight (and becomes the tap's target, which touch taps on edges
had silently lacked), a true background press shows the grab indicator, and
when the press turns into a pan the two swap, exactly as in v3. What remains
of the deviation is a frame of latency, recorded as such.

Clicking those edges then exposed the second half of the same gap: v4 was
hit-testing exactly the painted stroke, so a default-width edge was a
three-pixel target. v3 has always counted a hit within a halo of the stroke —
8 rendered pixels for a mouse, 24 for touch, with a smaller pair for nodes —
and v4 now applies the same halos in its pick passes, on both the GPU (edges)
and the CPU (nodes), for every gesture. The programmatic pick API stays
exact, deliberately: the halo is a property of fingers and cursors, not of
the question "what is at this point". The reference images did not move a
pixel, because the halo exists only in pick frames.

The last unpickable piece of an edge followed the same day: arrowheads.
They had never been hit targets in v4, and a recent correctness fix had
made that visible — the line now stops behind the head as it should, so the
pixels under a head belonged to nothing. Heads now answer as their edge, on
every arrow position and both edge streams, and a head's whole area counts
even when it is drawn hollow — which is how v3 has always treated them.
The cheapest implementation turned out to be the exact one: the drawing
shader already computes each head's true shape, so hit-testing reuses that
computation instead of approximating it.

The week closed by turning the same philosophy on the styling side. The
default stylesheet had carried v3's look for days — grey elements, blue
selection, a press highlight — but the developer harness sat on top of it
with hand-coloured demo pages that buried exactly those affordances. The
demos are now as minimal as v3's own (they style only the feature they
demonstrate), the harness's non-production style option is now literally the
default stylesheet rather than a third look, and every remaining custom
sheet re-states selection somewhere visible — on the colour itself where it
is constant, or through a border or underlay where the colour carries data.
A test now selects an element under every sheet and fails if nothing
visible changes, so the rule outlives the sweep that applied it.

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

**The last unported style pair landed** (round 38, 8 August). Dashed,
dotted and double borders and outlines now draw on every node shape, with
v3's exact semantics — dotted ignores the declared pattern, double erases
the middle third of the stroke — and the dash pattern starts where v3's
canvas path starts on each shape, because a half-period phase error reads
as anti-aligned dashes. The build overturned its own plan twice, both
times by measurement: the budgeted approximate ellipse parameterization
produced a larger mismatch than not dashing at all (so the test meant to
record it as a deviation could not fail, and exact elliptic arc length
shipped instead), and the first verification scenes at normal zoom could
not tell dashed from solid because antialiasing smeared the gaps — every
scene moved to a magnified close-up, where the five feature-off controls
now fail by three to thirteen times their bounds. The fragment-cost
premium the design review had accepted for dashed polygons measured as
noise at scene level on real hardware.

**The week closed with the documented queue empty of buildable work.**
Everything fully specced that this machine can run has landed; what
remains waits on a decision, another platform, or release credentials.
The two open decisions were prepared rather than left abstract: every
error site in the library was read and classified so the error-policy
sitting reacts to a measured list (198 sites; ~11 plausible demotions,
half of those undermined by the absence of a fallback renderer), and the
gesture-veto question got a written proposal — every candidate default
mapped to its explicit toggle, three veto points implementable today, and
the recommendation to drop the fourth rather than reorder press events.
Both decisions came on 2026-08-09, and both declined the surface: the
classification became the rationale for keeping every error thrown, and
the toggle map became the rationale for building none of the veto points.
Preparing a proposal well enough that the right answer is "no" is the
system working, not wasted work.

## Week 4 — 9–10 August: two decisions that decline, the trim reaches everything, the force layout is rebuilt, performance becomes visible across commits, and then every benchmark ends v4-faster

*18 commits — rounds 58–60 and the seventh design sitting.*

The week opened with the two prepared decisions taken, both by
declining the surface the preparation had priced (the error and
gesture-veto outcomes are described at the end of week 3), and with
the one decision-free renderer item left in the queue: three places
that still read untrimmed edge geometry after the arrow-gap work —
edge labels anchored ~2.6 px off what `midpoint()` answers, the
overlay/underlay/casing strokes ran from node centre to node centre,
and mid arrows on straight edges sat at the centre chord where v3
computes a four-point mean.  The first two were blocked on a hardware
budget: their vertex shaders sit at WebGPU's base limit of eight
storage buffers, with no slot for the column that carries the arrow
data.

The fix fused two node-geometry columns into one derived column,
spending the freed slot on the arrow data, under one rule: *ink* (the
line, the layer strokes) stops at the draw trim, *anchors* (labels,
mid arrows) sit at the accessor trim the API answers.  Both new
magnified parity scenes read **zero differing pixels** against v3, and
each fails by 8–28x its bound with the fix deliberately removed — a
control run that itself tripped the repository's documented
stale-bundle trap before yielding those numbers, and is recorded
doing so.

The scene that took three drafts is a real lesson.  Its first
draft measured an already-recorded compositing deviation instead of
the trim; its second measured something nobody knew: **v3 draws an
edge's overlay band `2 × padding` wide, v4 `width + 2 × padding`** —
so at small paddings v3's halo is narrower than the line and
invisible.  That divergence is logged for a decision, not silently
patched, because either resolution changes rendered output.

### Round 59: the force layout, rebuilt on what the field ships

The maintainer reported the force layout giving bad results on large
networks — "drifts apart too much... everything super zoomed out on
fit (invisible basically)" — and asked for a round grounded in what
COSE, fCoSE and the GPU layouts (G6 and friends) actually do.

Measurement found something sharper than a tuning problem: the
original model was **numerically unstable past node degree ~20** (a
textbook explicit-integrator bound), and real networks sit far past
it — the em-web fixture ended at a bounding box of 3×10¹¹ px with a
fit zoom of 2.3×10⁻⁹, the compound fixture destroyed 571 of 610
positions as NaN, and a destroyed run *reported success*, because NaN
compares false against every convergence bound.

Two research sweeps (ForceAtlas2, cosmos.gl, sfdp, s_gd2, t-FDP,
cuGraph; the CoSE/fCoSE line, AntV G6, d3-force, v3's own cose) and a
scratch prototype shaped the rebuild, each piece traceable to a
shipped system: d3's degree-normalised springs plus a capped step
(stability by construction, not by tuning); a real long-range
repulsion from a monopole pyramid over the existing binning grid
(the scheme the most-shipped web GPU layout, cosmos.gl, converged on
after abandoning its quadtree — and the GPU force kernel *ends up
with a spare binding* after a buffer fold); component-aware
placement — packed anchors, constant-magnitude gravity, and the same
end-of-run component packing v3's cose does — so disconnected pieces
neither interleave nor drift; fCoSE's spectral seed (a 40-node chain
now lands 3208 px end-to-end where the old scatter left it curled at
346); and the Bilkent compound recipe's gravity and nesting terms for
compound graphs.

The before/after, in the browser: em-web fits at **zoom 0.44** (from
2.3×10⁻⁹ — a blank canvas), the clustered compound fixture at 0.40
with its 41 clusters cohering inside their parent boxes (from
wholesale NaN), and the 465k-edge fixture — mean degree 47, exactly
the shape that exploded — **converges live on the GPU in 1.3 s** and
fits at zoom 0.76.  Every step landed tests-first with its control
run, and two controls were themselves findings: one spec measured
the component packer instead of the physics until a pinned node
isolated them, and the executor-parity spec turned out unable to
detect a missing far field at all — it has a dedicated spec now.

### Round 60: performance across commits, on the status page

The maintainer asked for a way to see performance progress or
regression across commits.  The archive of published benchmark runs
already kept every run's full results — round 46.5 built it so "a
report improvement applies to every past run" — but nothing ever
joined two runs: the only cross-commit signal was one averaged number
per run, which a 2× regression in a single row moves by well under a
percent.

The status site now renders a comparison page for every machine and
profile with at least two published runs: each benchmark row's median
across runs, the rows that moved more than 10% listed first, and two
built-in honesty devices.  Every mover shows how the *frozen v3
baseline* moved over the same span — v3's code never changes, so if
it moved, the machine did — and the page headline is the whole-run
drift, the average movement over all shared rows, so a row moving
near the drift factor reads as the box warming up rather than as a
commit's fault.  Runs from different machines are never compared;
the page refuses rather than producing a chart that would be a
hardware history in a performance history's clothes.  Checked
against the archive's own two renderer runs, the computed drift
matches a figure the record had measured independently, and the
"regressions" it lists are exactly the rows the record already knew
to be noisy — appearing in both directions at once, which is what
noise looks like.

The same round added benchmark rows for recent work nothing priced —
including a real number worth knowing: selecting 256 elements costs
about **9 µs** under a constant stylesheet and about **989 µs** under
a sheet that fully conditions on selection state, which is the
mechanism the default look uses — and closed a long-recorded test
gap (the half of the site build that writes files had no coverage at
all).  Two of the new benchmark rows were caught measuring nothing
by their own controls before they could publish a number: one
because the effect it priced was drowned until the fixture was made
extreme enough to show it, and one because a v3-shaped call
(`cy.collection(array)`) silently returns an empty collection in v4 —
a porting trap now logged for a decision.

Both benchmark profiles were then measured fresh and run through the
new comparison, **which found a real regression on its first use**.
The rendering tier is clean — overall drift under one percent, and
every apparent mover is a row family the record already knows to be
noisy, moving in both directions at once.  The Node tier was not:
since the default stylesheet gained its v3-parity selection look,
every select and unselect was restyling the selected elements in
full, and bulk selection under out-of-the-box settings had gone from
**38× faster than v3 to 3.3× slower** — the frozen v3 baseline
beside it did not move, so it was the code, not the machine.

**A follow-up round closed it the same day, by exactly the route the
finding had measured.**  A selection flip is a one-bit change whose
styling consequence is knowable up front — the difference between two
cached style records — so the engine now writes only the channels
that actually differ (one colour on a node, five on an edge) instead
of re-deriving the whole element.  Bulk selection measures ~8×
faster than v3 again, a change to a *geometry* property on selection
still gets the full treatment it needs, and the whole thing is
guarded by tests that were each proven able to fail.  The regression
existed for four days and was caught by the first tool that could
see it, which is the argument for the comparison pages in one
sentence.

### Round 62: every benchmark pair reads v4-faster

With the comparison pages live, the maintainer set a flat goal:
**every v4 benchmark should beat v3.**  As of 10 August it does — an
idle-box run of the full benchmark tier carries 287 v3-comparative
pairs, and the published run has zero v3-faster rows (geometric mean
11×; the narrowest margin 1.03×).

Getting there took ten verification runs and split cleanly into two
kinds of work.  The first was ordinary: 28 rows were genuinely losing,
and each got a real fix — the animation-handle lifecycle rebuilt on
prototype methods (a handle was ~6× v3's cost to construct, and is
now ~30× cheaper than it was), the
whole-object `data()` read cached against a write epoch (it had been
rebuilding the object per call), style reads planned per property name
instead of re-normalising per read, a traversal walk that had been
allocating a typed-array view per node now reading the adjacency rows
in place, and a tail of similar single-cause repairs.  Two of those
are logged surface changes: `data()` with no arguments returns the
same object until the next write invalidates it, and destructured
animation-handle methods must be re-bound — both narrower exposures
than v3's own behaviour at the same spots.

The second kind is the part worth remembering: **the last several
"losers" were the measuring instrument, not the library.**  Two
mechanisms were pinned with controls.  Where a comparison row shares
one operation closure between its two sides, the side declared first
samples against a warmer optimiser state — a systematic sub-nanosecond
bias, exactly the band where a handful of rows kept losing in the
suite while measuring at parity or better in isolation; the harness
now warms both sides before either samples.  And below about ten
nanoseconds a row sits at the harness floor, where run-order artifacts
own the result outright: the pan-position read lost eight consecutive
suite runs while measuring **four times faster than v3** in clean
per-process loops — v4's read had become cheaper than the machinery
timing it.  That row now does 32 reads per sample and is renamed to
say so.  Both fixes follow the project's oldest benchmark rule — a row
is guilty until shown to discriminate — applied, for the first time,
to the instrument rather than the subject.

The goal is a snapshot, not a floor: sub-10-nanosecond pairs will
always trade a percent or two run to run.  What the record supports
going forward is the published archive plus the comparison pages,
which is how any future regression of substance gets caught — the
same way round 60's was.

---

## What remains before 4.0

**This table lists what has been written down.** Several rounds that v4 needs
are not in it because they have not been scoped yet, and four of the rounds
that have already shipped were inserted after this sequence was planned. It is
an inventory, not a schedule.

A design sitting on 2026-08-06 swept the accumulated open decisions: the
`border-style` scope questions were settled (full v3 parity — built two
days later, see week 3), three surface changes made without a
call were reviewed and ratified, and shader minification moved from
optional to scheduled (it also landed two days later).

| | needs |
|---|---|
| `arrow-scale` quantization | **a decision.** Arrow scale is stored as a 1/16 step, so `arrow-scale: 1.4` draws at 1.375 — 1.8% small on the head, the gap and the spacing alike. Fixing it spends the six spare bits in the same field, which a seventeenth arrowhead shape also wants. One or the other |
| Edge overlay band width | **a decision.** v3 draws the halo `2 × padding` wide (invisible at small paddings), v4 `width + 2 × padding` (always visible). Either resolution changes rendered output |
| `cy.collection( arg )` | **a decision.** It silently returns the empty collection where v3 builds from the argument — throw, port the v3 form, or record the permissiveness |
| Hollow *mid* arrows | still show the line: they sit mid-edge, where a trim cannot reach. May end up unsupported rather than fixed |
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
