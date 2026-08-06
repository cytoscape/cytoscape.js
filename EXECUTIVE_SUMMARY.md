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
- **Last updated**: 2026-08-06, covering work through round 53.2 and the
  sixth design sitting (the open-decision backlog swept; see the table at
  the end).

---

## Where it stands

v4 is feature-complete against its own scope and is in release preparation. The
public API keeps v3's *shape* — `cy.add()`, `eles.filter()`, `node.position()`,
the traversal and algorithm surfaces — while several v3 mechanisms were removed
by decision rather than reimplemented, each recorded with its rationale.

Continuous integration is green again as of 2026-08-06, having been red on
every push for several weeks; `npm test` passes from a clean checkout.

| | |
|---|---|
| Automated tests | 2,021 unit · 250 module · 24 soak · 283 browser |
| Documented API | 362 members over 48 sections, gated at 100% |
| Visual regression | 43 golden images + live v3-vs-v4 pixel-parity scenes |
| Benchmarks | 24 suites; **13× faster than v3** on CPU work, **27×** on rendering (geometric means over 106 and 64 paired rows) |
| Style parity | v4 accepts 153 of v3's 291 style property names; the rest are dropped by decision |
| Bundle | 661 KiB minified, 179 KiB gzipped — 1.4× v3 (411 / 126 KiB) on the wire, of which **24% is WebGPU shader source** v3 has no equivalent of |

The headline case: a 19,607-node / 464,657-edge network initialises in **1.7 s
against v3's 19.1 s**, and holds **33 ms frames where v3 takes 4,460 ms**.

**Two questions remain genuinely open before 4.0** — the error/warning
policy (round 40, with its preparatory classification of every error site
approved), and which gesture defaults an event handler may veto (direction
set: explicit toggles come first).  The remaining unbuilt work —
`border-style` porting, the documentation site, shader minification, a
tighter compound fit bound, and release engineering — is decided and
scheduled.

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

## Week 3 — 3–6 August: hardening, release preparation, and a CI reckoning

*139 commits. Rounds 28–53.2.*

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

---

## What remains before 4.0

A design sitting on 2026-08-06 swept the accumulated open decisions: the
`border-style` scope questions were settled (full v3 parity, including the
erase behaviour of double borders; two dash properties port; cap/join are
dropped with the deviation recorded), three surface changes made without a
call were reviewed and ratified, and shader minification moved from
optional to scheduled.

| | needs |
|---|---|
| `border-style` / `outline-style` (round 38) | decided in full — build only |
| Error / warning policy (round 40) | a design sitting; first, every error site is classified into always-throws vs recoverable, so the "demote errors to warnings" option is decided on real numbers |
| Gesture-default veto (`preventDefault()`) | direction set — explicit toggles come first and remain primary; the exact list is designed when that work lands |
| Documentation site (round 46) | prose written by hand; the generated model is ready |
| WGSL minification (round 52) | decided — the comment-strip build step lands **before the alpha**, worth 10% of the download, gated by pixel-identical output |
| Compound fit bound (round 54) | scheduled — `fit()` still over-frames compound graphs ~1.8×; a directional, per-edge bound replaces the disc-around-centres formulation |
| Cross-platform validation (round 49) | macOS/Metal, Windows/D3D12, real-device touch. WebKit now runs in CI, where it correctly skips: that build exposes no WebGPU |
| Release engineering (round 50) | the release workflows are still v3's and are marked as not yet adapted |
| Release bake (round 51) | alpha/beta cycle, external-consumer smoke, then **4.0.0** |

---

## How this project works, in four habits

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
   that wrote it has proved less than it appears: every defect found in the
   final CI rounds was in something never executed on a fresh checkout, on a
   runner, or in a browser nobody could launch locally. The habit that follows
   is to reproduce the environment rather than reason about it.

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
