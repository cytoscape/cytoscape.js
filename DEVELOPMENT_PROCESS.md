# How v4 has been developed

A description of the process behind the Cytoscape.js v4 rewrite (the
columnar model and WebGPU renderer, issue #3486), from the first commit on
2026-06-11 to 2026-10-12.  It covers who did the work, how work was divided
up, how decisions were made and recorded, how results were verified, and
how the process changed as it went.

Sources: `PLAN.md`, the 193 section files in `plan/rounds/`,
`EXECUTIVE_SUMMARY.md`, `AGENTS.md` and `docs/agents/`, and
`git log unstable..v4`.  Where something here is an inference rather than
something the record states, it says so.  A companion document,
`AGENT_TOOLING.md`, inventories the tooling this process produced.

---

## Contents

1. [In one paragraph](#1-in-one-paragraph)
2. [Who did the work](#2-who-did-the-work)
3. [Timeline](#3-timeline)
4. [The unit of work: the round](#4-the-unit-of-work-the-round)
5. [The maintainer in the loop](#5-the-maintainer-in-the-loop)
6. [Rules for autonomous work](#6-rules-for-autonomous-work)
7. [Verification discipline](#7-verification-discipline)
8. [Recording: the record, the commits, the summary](#8-recording-the-record-the-commits-the-summary)
9. [How the process changed, rule by rule](#9-how-the-process-changed-rule-by-rule)
10. [Branches, worktrees and parallel work](#10-branches-worktrees-and-parallel-work)
11. [Scale, in numbers](#11-scale-in-numbers)
12. [The working principles](#12-the-working-principles)
13. [Weaknesses the record admits, and observations](#13-weaknesses-the-record-admits-and-observations)

---

## 1. In one paragraph

v4 was built by one maintainer directing AI coding agents, mainly Claude
Code, with Codex used in places (see §2).  The work was cut into numbered
**rounds**: 148 so far, plus sub-rounds and inserted rounds.  Each round
was planned in writing, implemented in isolated commits with its docs in
the same commits, verified against gates that had to stay green, and
closed with a written record of what was measured and what went wrong.
Agents did the implementation, measurement and preparation, much of it
unattended.  The maintainer made the design calls, in numbered **design
sittings**, **screen passes** (the maintainer driving the debug page and
reporting what's wrong) and **interviews**.  Every question waiting on a
decision went into one ledger, "Open calls for the maintainer".  The
process was itself treated as a product.  When it failed (stale docs, a
record too big to read, an agent-generated worktree leaking into the npm
package), the fix was a new rule, usually enforced by a spec.

---

## 2. Who did the work

### 2.1 The maintainer

Every one of the 1,240 commits is authored by Max Franz, the maintainer.
The record calls this role "the maintainer" or "the user".  The maintainer:

- set the constraints of each phase, for example pass 1's "parallel core in
  a new directory" and API scope limits (`2026-07-22-01-rnd0000-note-context`);
- took design calls in sittings and interviews;
- tried the result by hand ("opening the page") and reported defects;
- decided anything touching public API, defaults, visual quality,
  destructive cleanup or external setup (§5.5).

### 2.2 The agents

The record names two agents.  Round 108's brief was to "keep it working
with **both Codex and Claude Code**", and `EXECUTIVE_SUMMARY.md` describes
`AGENTS.md` as the file "which both Codex and Claude Code load verbatim".
The record does not say which agent wrote which round.  The commit trailers
give a partial picture:

| Period | Evidence | Reading |
| --- | --- | --- |
| 06-11 – 06-30 | `Co-Authored-By: Claude Opus 4.8 (1M context)` (24), Sonnet 4.6 (5) | Claude Code |
| 07-13 | 33 untrailered commits, unwrapped one-paragraph bodies | non-Claude, probably Codex (inference) |
| 07-22 – 07-28 | ~118 untrailered commits, 72-column bodies citing #3486 | probably Claude Code before trailers were adopted (inference) |
| 07-29 – 08-02 | `Co-Authored-By: Claude Fable 5` (146) | Claude Code |
| 08-02 – 08-08 | `Claude Opus 5 (1M context)` (175), Sonnet 5 burst on 08-05 (24) | Claude Code |
| 08-08 – 09-30 | `Claude-Session:` only; model not named | Claude Code |
| 10-05 – 10-11 | 58 untrailered commits: unwrapped bodies, `Validation:` lines, 7 detached worktrees under `~/.codex/worktrees/` | mostly Codex (inference) |
| 10-12 | `Claude-Session:` | Claude Code |

Totals: 942 commits carry a `Claude-Session:` trailer, across **44 distinct
sessions**, and 374 carry a `Co-Authored-By: Claude …` trailer.  263 carry
neither.

### 2.3 Sessions

Session sizes vary a lot.  Two sessions account for nearly half the
history: one ran 07-29 to 08-08 and produced **339 commits**, another ran
09-28/29 and produced **128**.  Most other sessions are a single day with
1–32 commits.  From mid-August, several sessions often ran on the same
day.  131 commits landed between 00:00 and 03:00 local time, which points
to long unattended runs (inference).

---

## 3. Timeline

Commits per month: June 43, July 247, August 551, September 335, October 64
(up to 10-12).  The peak was the two weeks 07-27 to 08-09, with 455 commits.

### Phase A — TypeScript migration of v3 (06-11 → 06-30, 46 commits)

Before any v4 work, v3 was modernised in place.  The bundler moved from
rollup to rolldown (`76a5613a`), then nine "TS migration phase N" commits
converted the codebase over two days (`611ff3a4` … `4d9cf91a`, the last
generating `.d.ts` from source and dropping Babel).  Type-parity cleanup
continued through June, ending at `afc974e6` (06-30).  Then there was a gap
of almost two weeks.

### Phase B — Toolchain day (07-13, 33 commits)

In a single day: ESLint was replaced by oxlint (`9ab298bb`), Mocha by the
`node:test` runner (`eb75034b`), TypeScript was upgraded to 7 (`d6d6ce96`),
and a v4 runtime baseline was set (`d88b634f`).  This toolchain is what
later made the fast inner loop possible.

### Phase C — Prototype pass 1 and the first rounds (07-22 → 07-31)

- **07-22: "the whole stack, stood up in one day".**  It started from
  `e30542cf` ("gpu: add columnar store and model-renderer contract"): the
  store, the selector language, the core facade, the build, the render
  pipeline and the debug harness, all in `src/gpu/`, beside v3, on a branch
  that "started as `feature/webgpu`".  Pass-1 constraints were agreed with
  the maintainer first: a CPU-canonical columnar model, a parallel core in a
  new directory, and a narrow API (viewport, events, graph manipulation,
  grid).  Animations, stylesheets, layouts, algorithms, compounds and
  `data()` were all out of scope.  The verification note recorded 918 Node
  tests, all green.
- **07-23:** 64 commits; `PLAN.md` created (`d32a760f`); "API gaps vs v3"
  sorted into tiers: low-hanging fruit, small-touch, needs-a-call, deferred.
- **07-24:** rounds 7–9 (mapper DSL, conditionals, animation).  Selector
  removal and the stylesheet reshape were "decided in design discussion …
  and implemented in one pass".
- **07-27: round 10, "the autonomous parity sprint".**  17 items, all
  landed, with Node tests going from 1,461 to 1,629.  This round set the
  rules for autonomous work (§6).
- **07-28:** measurement infrastructure: the benchmark HTML report, and v3
  canvas vs v4 WebGPU renderer benchmarks.
- **Rounds 11–27:** curves (12a/b/c), compounds, GPU force layout (18),
  charts, labels.  These ran "largely autonomously", which later had to be
  corrected (§5.4).

### Phase D — Sittings, contracts and the restructure (08-01 → 08-10)

- **08-01:** a hardware validation pass on an AMD RX 580, and the first
  four design sittings (z-index dropped outright; animation, display and
  charts; style transitions).
- **08-03:** documentation and error contracts "gated at zero tolerance";
  the benchmark sweep (round 33) and its fixes (34).  The "Open calls for
  the maintainer" section was created.
- **08-04:** the fifth sitting, "every open call taken, rounds 37–50
  planned" (the production-readiness roadmap).  On the same day:
  - **Round 42, "the great restructure"** (`f90182d9`): v4 became the
    package at the repo root, v3 moved whole into `v3/`, and the root
    package became `cytoscape@4.0.0-unstable`.  It was verified by
    comparing files byte for byte, not just by the suite (§7.5).
  - Round 43 (debug harness), 44 (packaging), 45 (docs generator), 47
    (migration guide) and 48 (robustness and soak).
- **08-05:** round 46.5, the status site, "inserted at the maintainer's
  request, ahead of round 46".  `EXECUTIVE_SUMMARY.md` was created.  The
  maintainer opened the rebuilt debug page and found three real defects
  "none … reachable from any suite".
- **08-06:** round 53, "CI made honest".  Sixth sitting: a full read of the
  record found decisions buried in round records, against the rule.
- **08-09:** round 62, after which every benchmark pair read v4-faster.
  Seventh sitting.  The eighth sitting followed on 08-10.

### Phase E — The round machine (08-10 → 09-30)

The highest round number climbs fast: 57 (08-07), 72 (08-14), 102 (08-20),
111 (08-28), 124 (09-10), 133 (09-28), 145 (09-29).  Commit scopes become
the round number itself (`feat(65.9b):`, `docs(108.4):`).

- **08-10 – 08-12:** async algorithms and GPU executors (65); load path and
  algorithm families (66–70).  Ninth sitting.
- **08-14: tenth sitting.**  Three research sweeps (the repo record, the
  GitHub tracker, the ecosystem apps) fed a shortlist of 15 items.  The
  result was the "mid-August planning wave", with rounds 71–86 planned and
  "verified against the source before planning".
- **08-17 – 08-23:** round 90, the API review (460 → 355 public members).
  **08-18: the maintainer's screen pass**: seven defects found by driving
  the debug harness, one round each (91–97), all landed by 08-28.  Rounds
  98–100 (runtimes) and 101 (quiet verification).
- **08-24 – 08-30: the repo made workable for agents.**  Round 108 (agent
  ergonomics), 108.2 (record split into files), 108.7–108.9 (filenames,
  titles), 111 and 111.1 (the kind field tells the truth), 86 (worker
  renderer).
- **08-31 – 09-13: layouts.**  Flow (112), the performance review against
  the 13 Aug baseline (113), layout and force rounds (114–121), portfolio
  audit (122), packing (123), taxi tracks (124).  Maintainer sittings in
  front of the force page on 09-08.
- **09-14 – 09-20: audit and refactor.**  The feature inventory and alpha
  gates (09-13/14), the layout quality audit (125, sub-rounds signed off one
  sitting at a time), string constants (127), cancellation (128–129), and
  round 130, which split the ten largest files across ten sub-rounds.
- **09-21 – 09-27:** bundles and slim entries (131), features page (132).
- **09-28: eleventh sitting**: every open call, one at a time, each "with
  its background and priced options".  **09-29:** rounds 133–145 landed,
  84 commits in one day, the busiest of the project.

### Phase F — Toward alpha: interviews and contracts (10-03 → 10-12)

- **10-03: alpha design interview.**  It chose the sequence 146 → 147 →
  80 → 82 → 148.
- **10-05:** rounds 146–148 (charts, hulls, miniature compounds) landed:
  42 commits, mostly in the Codex style.
- **10-06 – 10-11:** the alpha contract interview, about 30 dated
  subsections written as "Specify …" / "Record …" commits.  Research on
  annotations and overlapping membership was supplied by the maintainer
  (10-08), and an open-question register was built (10-11).
- **10-11:** six independent Claude Code worktrees each re-ran round 79
  (§10.3).
- **10-12:** the `Depends on:` rule and the `plan-deps` graph scene.

---

## 4. The unit of work: the round

### 4.1 One file per round

Since round 108.2, the record is one file per section in `plan/rounds/`,
named `YYYY-MM-DD-NN-rndRRRR-kind-slug.md`.  The kind is `plan`, `landed`
or `note`.  `rnd0000` marks a section about no single round (sittings,
interviews, research), and a span is written `rnd0091_0097`.  The filename
carries the bookkeeping, so the heading is just a title (108.9).  The
round number is in the name because "nobody has ever asked for section
143.  They ask what round 106 said."  Since 2026-10-12 every file's second
line is `**Depends on:** …`, naming the earlier rounds or notes it builds
on.

### 4.2 Writing a plan

Round 12's plan (`2026-07-29-04-rnd0012-plan-curved-edges.md`) is a typical
example.  It has:

- **Motivation**: why now, and what it unblocks.
- **Implementation calls (made at planning)**: the decisions the agent may
  take itself, e.g. "Geometry ports v3's math verbatim … No silent
  simplifications: any spot where v3's math can't ride the GPU path becomes
  its own logged call."
- **A pass split** into sub-rounds (12a/b/c), each with its test burden
  named: Node geometry tests pinned against v3, a golden scene, a live
  v3-parity scene, a zero-rebuild spec.
- **A perf expectation**: "record the numbers in the round record".
- **Open calls**, signed off by the maintainer before work starts.

Later plans add more structure:

- **"Controls named at planning"**: how each new gate will be shown to
  fail, e.g. "add 10 KB of prose to `AGENTS.md` and watch `agent-docs.mjs`
  go red" (108).
- **"Risks named at planning"** (18, 42, 130).
- **"Decided at planning (maintainer, date)"** and **"Open:"** lists.
- **"What the round does not do"** (125).

By October, plans read as contracts: "Settled contract", numbered
sub-items, and "Acceptance and controls … Each corresponding test must
fail" (146–148).

### 4.3 Landing it

The same file is renamed from `plan` to `landed`, and the landed record is
appended.  Items become a checklist:

- `[x]` landed;
- `[~]` built and then removed (e.g. "built, then removed the same day by
  46.5.7");
- held for a call.  A round can land with an item held, and the file says
  which.

A landed record typically has:

- a commit table (`143.1 | 581b60b3 | …`);
- verification: which gates, tallies, or "zero bytes" from the quiet
  twins;
- measurements, usually with a v3 control;
- "What building it found" / "What the round found that it had not planned
  for";
- "Calls taken in-round", "Deferred", and "Open, carried forward";
- noticed flakes, with their mechanism;
- a closing line: "**Round 42 is complete.**"

Deviations from plan or from process are written down, not hidden.  For
example, round 43's follow-up says: "*Process note, on the record rather
than as silent drift*: the four items below landed as four isolated
commits … with one closing docs commit."

### 4.4 Sub-rounds and inserted rounds

- **Lettered passes**: 12a/12b/12c.  Written as base round `12` in
  dependency lines.
- **Decimal items**: 18.4, 42.1–42.6, 108.1–108.9, 125.1–125.10, 130's ten.
- **Inserted rounds**: 9.4–9.7, 43, 46.5, 46.6, 55, 56, each "inserted at
  the maintainer's request" or after a maintainer saw something on screen.
  Inserting 43 renumbered 43–50.
- **Renumbered on integration**: 126 was "drafted as provisional round 999
  on `feature/shader-minification`".
- **Items**: `PLAN.md` keeps numbered items (up to 91) that are "never
  reused", and rounds are often named for the items they take (e.g. "round
  138, items 34–36").

### 4.5 Kinds of round

| Kind | Examples |
| --- | --- |
| Feature / parity | 7 (mapper DSL), 10 (parity sprint), 12 (curves), 18 (GPU force), 146–148 |
| Review / audit | 90 (API review), 113 (performance review), 122/125 (layout audits), 143 (golden degrade control), the 43 follow-up |
| Restructure | 42 (v4 becomes the package), 130 (large-file split) |
| Tooling / process | 43 (debug harness), 46.5 (status site), 101 (quiet verification), 108 (agent ergonomics), 111 (kind field), 126 (shader minification) |
| Research / specification (`note`, no code) | the parity gap analysis, prepared galleries, the October interviews and question register, literature research |

---

## 5. The maintainer in the loop

### 5.1 Design sittings

There have been eleven numbered sittings (08-01 to 09-28), each recorded as
a `note` file.  Their shape: "Decided with the user in one sitting", the
call, "Reasoning, recorded", then "Queue after the sitting", the new order
of rounds.  Calls are one bold line each: "Item 23 — `arrow-scale`
quantized to 1/16: leave it."; "Item 44 — the codemod: declined."  The
fifth "lands as a PLAN.md-only edit — decisions and plans, no
implementation".  The sixth was prompted by a full read of the record,
which found decisions that had piled up in round records.  The eleventh
went through every open call in turn.

### 5.2 Screen passes: "something has to open the page"

The most productive maintainer input was using the thing:

- 08-05: the first real user of the round-43 harness found three defects.
  One was in `src/`, and visible in every app with a compound graph.
- 08-18: the screen pass found seven defects in one sitting, each "verified
  before planning — reproduced in a served page", one round each (91–97).
- Rounds 55 and 56 "both began with a maintainer opening a page and seeing
  something no test in this repository could".

This became a standing rule in `AGENTS.md`: renderer, gesture and
grab-state changes must be checked in the debug page.

### 5.3 Agents prepare; the maintainer judges

Agents prepare decisions rather than take them.  The
`2026-09-29-12 … items 72 and 73 prepared` note "takes no calls.  Each item
ends with the sitting's questions as numbered options with their
consequences and a recommendation."  Round 125's plan says it directly:
"Agents prepare; the maintainer judges … A sub-round with no recorded
sitting is not landed, whatever its specs say."  Readability "stays with
the sitting and is not faked as a spec".  Verdicts are recorded inline:
"Signed off: 125.8.  Decided in part: 125.3 …  Deferred to the page: …".

### 5.4 One ledger for open questions

"Rounds 10–29 ran largely autonomously, and some decisions got absorbed
into parity work without a human in the loop.  This section is the one
place those surface."  So **"Open calls for the maintainer"** (since 08-03)
holds:

- **new open calls** — scope and design questions;
- **contradictions** — code that disagrees with the decided-design ledger,
  "usually because an autonomous round kept or added something the ledger
  says was dropped";
- **logged round ideas** — raised but not scoped, each with "the first
  thing that would have to be measured".

Two rules govern it: "**Log a contradiction; never silently patch it**",
and "an item leaves only when the call is made".  The ledger is swept in
every closing sweep.  On 08-26 it was found unswept for sixteen days and
fourteen rounds, which became a lesson in its own right.

### 5.5 What is reserved for the maintainer

- **Public API and semantics.**  "API semantics are never improvised
  autonomously" (round 10).
- **Defaults and visual quality** (round 125).
- **Destructive cleanup**: "The round-90 worktree was not deleted.  It
  holds 8 commits not on `v4` … removing it is the maintainer's call" (108).
- **External setup**: "What the maintainer still owns: create the Pages
  project" (46.5).
- **Agent-specific configuration**: a committed `.claude/settings.json`
  allowlist "was offered and declined"; the harness config stays portable
  across agents (108).

### 5.6 Interviews (October)

For the alpha contract, sittings became interviews.  The rules for them:

- "Ask the maintainer one decision at a time.  Keep settled choices
  settled."
- "Recommendations are not approvals."
- "Later answers supersede earlier alternatives", and superseded
  alternatives are kept for their reasoning.
- Some calls are **benchmark-gated**: "undecided pending benchmarks … Do
  not choose a target contract merely for v3 parity."
- Option tables (A/B with benefit and cost); "deliberately deferred, not
  approved as B".
- A topic-organised **open-question register** (`2026-10-11-01`) separates
  what is decided, what needs evidence, what needs a manual review, and
  what is ordinary detail that "can be resolved consistently with the
  approved contract … without another interview".

---

## 6. Rules for autonomous work

Round 10 (07-27) set the frame for unattended agents:

- **Scope only what is decided**: "items whose design is already decided …
  and that are easily verifiable", so the round "can run autonomously as
  far as possible".
- **Escalation**: "if an item turns out to need a real design call
  mid-implementation, stop that item, log the question under 'Needs a
  call', and move on."
- **Isolated commits per item**, each passing the full gate, with **docs in
  the same commit**.
- **Goldens regenerated autonomously** when a visual change is intended.
  Never edited by hand.

Round 14 (07-31) added two rules, standing policy from the 08-01 sitting:

- **Docs land first**: a plan commit before any implementation.
- **Tests first**: specs "written and seen red before the implementation".

Later, `AGENTS.md` turned these into a short operational routine: run
`npm run -s verify` while iterating, run the routed gate before handing
back, open the page for anything drawn, and call out public-semantics
changes in the summary.

---

## 7. Verification discipline

### 7.1 Gates that must be green

Each item passes the full Node gate (typecheck, `test:js`, `test:modules`,
`test:soak`, `test:throws`, lint), plus Playwright where relevant.  Early
records quote tallies, e.g. "2142 Node tests, 138/138 Playwright,
typecheck + lint clean" (round 18).  After round 101 they quote silence:
"`npm run -s test:node:quiet` zero bytes".

### 7.2 Controls

The project's main habit is to **break the thing on purpose and confirm
the test goes red**:

- "restoring the chord fails the first" (43);
- "Controls, each turning its spec red and then restored" (126);
- "Three negative controls failed at their intended assertions … Every
  temporary source and test edit was restored exactly" (146);
- round 143 built a whole degrade control for the golden images.

When a control does not fail, that is recorded as a finding: either the
code or the spec is redundant.

### 7.3 Measure before designing

Round 46.5 measured fixture sizes against the 25 MiB hosting cap and
dropped its gzip plan.  Round 101 measured green-run output (3,072 lines /
180 KB) before designing the quiet twins.  Plans are checked against the
source before they are written, because "a plan's statements about the
code are claims to re-measure, not facts to build on".

### 7.4 Benchmarks

Benchmarks are same-machine A/B runs with frozen v3 as a control.  Each run
records the machine (i9-9900K / RX 580), a harness fingerprint, a pinned
Node version, `--repeat 3` medians with spread, and `meta.dirty` for
uncommitted trees.  Results are read against noise, not single numbers.
Round 130.12, for example, found a "double hop" at 1.021× (v3 control at
1.030), fixed it, and re-measured 1.005.  Costs are stated as costs: "a
measured renderer cost, not a no-cost claim" (146).

### 7.5 Byte-identity for restructures

Restructures were shown to change nothing by comparing files, not just by
a green suite:

- **Round 42:** "every file now under `v3/` was compared byte-for-byte …
  (821 files, 6 differed, all six intended)", and the goldens stayed
  byte-stable.
- **Round 108.2:** joining the split files back together "reproduces the
  pre-split file exactly, 1,524,666 bytes".
- **Round 130:** `docs:api` output identical apart from line stamps, and
  harness canvas pixels identical before and after.

### 7.6 Parity and the page

Rendering rounds are checked against live v3 parity scenes ("`parity-compounds`
at 2.092%"), exact goldens, and by opening the page: "The page, opened:
`debug/index.html` … drew the EnrichmentMap web network … with no
shader-compilation or validation message" (126).

### 7.7 Honest limits

Gates that could not be run are named as such, not reported as passing:

- "Recorded rather than silent" — WebKit launch failures (42);
- "that gate is unvalidated … These process/browser gates therefore remain
  environment-limited" (147);
- "visual report review was unavailable because the computer connector
  exposes no browser" (a 10-11 commit).

Flakes are logged with their mechanism, not re-run until they pass: "a spec
that fails 50% of the time under load is worse for an agent than one that
fails always — it teaches the agent to re-run rather than to read" (108).

---

## 8. Recording: the record, the commits, the summary

### 8.1 The record is part of every change

62% of commits (766 of 1,240) touch the record: `PLAN.md`, `plan/`,
`src/README.md`, `EXECUTIVE_SUMMARY.md` or `AGENTS.md`.  19% touch only
the record.  The rest change code and record in the same commit.  `PLAN.md`
alone is touched by 509 commits.

| Month | Commits touching the record |
| --- | --- |
| Jun | 5% |
| Jul | 55% |
| Aug | 69% |
| Sep | 60% |
| Oct | 67% |

### 8.2 The usual shape of a round in git

A plan commit (`plan:` / `docs(N): round N plan`), then sub-round commits
(`feat(N.k):`, `test(N.k):`, `bench(N):`), then a record commit
(`docs(N): the round record …`), then a closing sweep.  In the sweep,
`src/README.md` and `PLAN.md` are read end to end for staleness, the index
is regenerated, `EXECUTIVE_SUMMARY.md` is rewritten, and the worktree list
is checked.

### 8.3 Commit messages

| Month | Conventional prefix | `x(N):` round scope | Avg subject | Avg body |
| --- | --- | --- | --- | --- |
| Jun | 11/43 | 0 | 53 ch | 860 ch |
| Jul | 243/247 | 0 | 58 | 903 |
| Aug | 549/551 | 149 | 69 | 1,752 |
| Sep | 326/335 | 292 | 97 | 1,328 |
| Oct | 33/64 | 5 | 49 | 603 |

The style changed over time:

- **June:** plain imperative.
- **07-13:** lowercase conventional commits.
- **Late July:** a `gpu:` prefix.
- **After round 42:** subsystem scopes, then the round number as scope.
  Bodies are wrapped at 72 columns, written as essays, and explain the
  decisions taken "with the maintainer".
- **October:** shorter, unwrapped, with a closing `Validation: …` line.

The median body is about 1,250 characters, so commits are written to be
read as part of the record.

### 8.4 `EXECUTIVE_SUMMARY.md`

Created 08-05 and rewritten at every round close.  It is the five-minute
version, organised by calendar week and written in outcomes rather than
file names.  Its three rules:

- **Restate, don't append** — later rounds change what earlier decisions
  meant.
- **Re-measure every number.**
- An item leaves the open table when **decided**, not when scheduled.

It is the only narrative that spans rounds, because the one `PLAN.md` used
to carry silently stopped at round 64.

### 8.5 `src/README.md`

The maintained scope, deviations and design-decisions document, about
8,900 lines, organised by subsystem and round.  It is updated in the same
commits as the code.

---

## 9. How the process changed, rule by rule

Almost every rule came from a specific incident.

| Date | Rule | Incident that caused it |
| --- | --- | --- |
| 07-27 (r10) | Isolated commits, full gate per item, docs in the same commit, escalate design calls | First autonomous sprint |
| 07-31 (r14) | Docs land first; tests seen red first | Set by the maintainer; standing from 08-01 |
| 08-01 | Closing docs sweep at every round end | Post-round-19 sweep found drift the per-commit rule missed |
| 08-02 | Sweep `PLAN.md` too | Round 27's sweep left the gap ledger saying three just-built features were unbuilt; one list went 17 rounds unswept |
| 08-03 | "Open calls for the maintainer" ledger | Rounds 10–29 absorbed decisions without a human |
| 08-03 → | Docs and error contracts gated at zero tolerance | Doc comments wrong about errors that ship in `.d.ts` hover text |
| 08-05 (r46.5) | Rewrite `EXECUTIVE_SUMMARY.md` at every close | A stale summary is the most public thing the repo can get wrong |
| 08-05 | "Open the page" for renderer/gesture changes | Three defects found by the harness's first real user |
| 08-06 | Sixth sitting sweeps buried decisions | Decisions had accumulated in round records |
| 08-20/24 (r101) | Quiet twins; green = zero bytes | A green `test:node` was ~3,800 lines of agent context |
| 08-24 (r108) | `AGENTS.md` as a 16 KiB router; notes in `docs/agents/` | 62,818 bytes (~15.7k tokens) loaded before any task |
| 08-24 (r108.2) | Record split into one file per round | `PLAN.md` at 1.5 MB / ~381k tokens could not be read by the agents it was written for |
| 08-24 (r108) | `.ignore` hides `v3/` from search | v3 was ~57% of every search hit |
| 08-24 (r108.4) | Check `git worktree list` when closing | A leftover 352 MB agent worktree put 141 of 278 files into `npm pack` |
| 08-25 (r108.8) | `PLAN.md` carries no narrative of its own | Its summary had stopped at round 64 while 44 more rounds landed |
| 08-26 (r111) | The kind field is the round's state, gated three ways | 33 shipped rounds still filed as `plan`; sweeps had marked 17 unbuilt rounds as shipped |
| 08-28 (r111.1) | A round closed by decision is closed | Round 40 shipped nothing on purpose and read "planned" for 19 days |
| 09-02 | Benchmarks refuse the wrong Node major | An hour spent comparing Node 22 against a Node 24 archive |
| 10-11 | Interview rules and the open-question register | Consolidating the alpha interviews: "the register identifies what is actually unanswered" |
| 10-12 | `Depends on:` line on every section, gated, graphed | Making prerequisites explicit across 193 sections |

---

## 10. Branches, worktrees and parallel work

### 10.1 History is almost linear

1,224 of 1,240 commits are on the first-parent line.  There are only four
merge commits: `test/fix-v4` (08-06), the round 69/70 algorithm matrix
(08-12), round 108 (08-24) and round 93.2 (08-28).  Other branches were
fast-forwarded or rebased: `feature/round-130-large-files`,
`feature/round-86-worker-renderer`, `round-90-api-cleanup`,
`worktree-round-108-agent-ergonomics`, the layout experiments, and others.
Item 53 recorded the maintainer's call on old round branches: "keep all".

### 10.2 Worktrees for isolation and parallelism

Agent rounds often ran in git worktrees (`.claude/worktrees/…`).  Round 125
ran "125.1, 125.2, 125.9, 125.4 in parallel worktrees", while the
maintainer's review sittings stayed serial.  CI failures were reproduced by
running the CI job's commands in a fresh `git worktree add --detach`.  The
risk of worktrees left behind (§9, 08-24) led to `.gitignore` and
`.npmignore` rules, a packaging spec, and the closing-sweep check.

### 10.3 Six parallel runs of round 79 (10-11)

Six locked worktrees under `.claude/worktrees/` (`dreamy-cuddling-naur`,
`keen-plotting-goblet`, `linked-meandering-finch`,
`precious-hugging-hanrahan`, `typed-snuggling-galaxy`,
`wondrous-puzzling-rose`) all branch from `1b167ccc` (09-28 17:36).  That
is the commit just before round 79 (JSON schemas) landed on `v4`, at
`5a61f0d9` (09-28 23:10).  On 10-11, each was worked in its own Claude Code
session, starting within about 100 minutes of each other.  Each one
re-implemented round 79 from scratch (10–23 commits, from an "ajv as a
test-only devDependency" commit through to its own close of the round).
None is merged.

The record does not explain these.  They look like repeated, independent
replays of an already-landed round from its starting point, for example to
compare how different runs carry out the same plan (inference).

---

## 11. Scale, in numbers

| Measure | Value |
| --- | --- |
| Commits (`unstable..v4`) | 1,240, from 06-11 to 10-12; 68 active days |
| Claude Code sessions (trailers) | 44 |
| Rounds | up to 148; landed 7–48, 52–70, 72–76, 79–80, 82, 85–98, 100–124, 126–136, 138–148 |
| Rounds still planned | 49–51, 71, 77–78, 81, 83–84, 99, 125, 137 |
| Record sections | 193 (150 landed, 29 notes, 14 plans) |
| Design sittings | 11, plus 2 alpha interviews |
| `PLAN.md` items | 91 |
| Node tests | 918 (pass 1) → 1,629 (round 10) → 2,245 `test:js` (08-20) |
| Browser coverage | 53 exact goldens, 56 live parity scenes, 12 routing-parity, 24 algorithm-parity, 10 gesture traces |
| Documented public API | 347 members (after round 90's cut from 460) |
| Feature inventory | ~960 rows in `docs/features.csv` |
| Benchmarks | 31 suites; all 373 v3-comparative pairs v4-faster as of 09-02 (core 10.7×, renderer 31× geometric mean) |
| Inner loop / gate | `verify` ~9.6 s (recorded), `test:node:quiet` ~88 s |

---

## 12. The working principles

`EXECUTIVE_SUMMARY.md` closes with the principles the record kept returning
to:

- **A control for every claim.**  A test, benchmark row or audit counts
  only once it has been seen to fail when the thing it checks is broken.
- **Measure, don't remember.**  Numbers and claims in the record are
  re-measured before they are relied on.
- **Decisions are written down when taken**, in one place.
- **Run it where it will actually run**: the built bundle, the real
  browser, the real GPU, the real runtime.
- **A change that should be invisible is the best test of the tools that
  watch for changes**: restructures, reformatting and file splits are used
  as free controls on the tooling.

---

## 13. Weaknesses the record admits, and observations

The record criticises itself.  `PLAN.md` warns that "a per-round record
reads optimistically by construction.  Every round closes green", and that
phrases like "the autonomous shelf is clear" were "each true about their
own scope and say nothing about the distance to 4.0".  Specifically:

- **Autonomy absorbed decisions** (rounds 10–29).  The fix was the open-calls
  ledger, and logging contradictions instead of patching them.
- **Derived views drift when their input is wrong**: three sweeps marked 17
  unbuilt rounds as shipped, and round 40 read "planned" for 19 days.
- **Suites miss what people see** in minutes on screen (rounds 43, 55, 56;
  the screen pass).
- **Audits read as complete while missing whole files** (`@param` at
  "100%" while `src/index.mts` contributed zero members).
- **The plan is not a release estimate**: "Read 'what remains' as an
  inventory of what has been written down; it is not an estimate."

Observations from this survey (not from the record):

- **Agent attribution is incomplete.**  Model names stop after 08-08, and
  Codex work is identifiable only by style.  A trailer per agent would make
  the history auditable.
- **Experiment state is not recorded**: the six round-79 worktrees and the
  seven Codex worktrees exist only on this machine, with no section in the
  record.
- **Process and authority are clear; release scope is not yet.**  Rounds
  46 and 49–51 (docs site, cross-platform, release engineering, release
  bake) are still planned, and the alpha contract is mid-interview.
