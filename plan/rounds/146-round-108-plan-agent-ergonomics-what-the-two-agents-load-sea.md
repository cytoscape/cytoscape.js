## Round 108 plan — agent ergonomics: what the two agents load, search and trip over (raised by the maintainer 2026-08-24)

The ask: review the repo for coding-agent performance, keep it
working with **both Codex and Claude Code**, and propose the lowest
hanging fruit with the biggest impact.  The constraint that shapes
every item below is the portability one: whatever is added has to be
read by both agents, which in practice means **`AGENTS.md`, nested
`AGENTS.md` files, `package.json` scripts and ordinary files on
disk** — Claude Code reaches the same content through the one-line
`CLAUDE.md` that imports `AGENTS.md`, and nothing here is written in
a format only one of them parses.  The maintainer ruled out
agent-specific harness config (a committed `.claude/settings.json`
permission allowlist was offered and declined) for exactly that
reason.

Seven findings, all measured on 2026-08-24 against `12eccd14`:

- **F1 — the preamble costs 15.7k tokens before the task is known.**
  `AGENTS.md` is **62,818 bytes**, and both agents load it verbatim
  at session start, every session, whatever the task.  It is no
  longer an instruction sheet: it is this repo's lessons-learned
  essay, and the essay is *good* — most of it is a defect that was
  paid for once and written down so it is not paid for twice — but
  an agent fixing a typo in a benchmark comment still reads the
  golden-image tolerance history, the SwiftShader worker ratio and
  the Fedora `libjpeg.so.8` recipe.  Its longest line is 2,021
  characters.
- **F2 — `PLAN.md` cannot be read by the thing it is written for.**
  1.5 MB, **~381k tokens**, 147 `##` sections.  No agent can open
  it whole; the ones that try lose the session.  Appending a round —
  which the process rules require — means editing a file no read
  tool will open, so every round-closing edit is done blind at the
  tail.  The record is the repo's most valuable document and its
  least reachable one.
- **F3 — most of what a search returns is v3.**  821 of the 1,290
  tracked files are under `v3/`.  Probe terms, repo-wide vs
  outside `v3/`: `style` **457 → 189**, `renderer` 213 → 117,
  `boundingBox` 116 → 73, `controlPoints` 37 → 20.  So roughly
  **55–60% of every search result is a codebase the agent is not
  working on**, and nothing on disk says so: there is no nested
  `AGENTS.md` in `v3/`, so an agent that opens `v3/src/style/index.mts`
  and starts "fixing" it is following the evidence it was given.
- **F4 — a leftover agent worktree breaks the build and would ship
  to npm.**  This is not hypothetical; it is the state of the
  maintainer's checkout right now.  `.claude/worktrees/round-90`
  (**352 MB**, branch `round-90-api-cleanup`, still registered in
  `git worktree list`) makes **`test:modules` red**: the round-44.2
  markdown allowlist in `test/modules/packaging.mjs` sees eight
  documents where four are expected, four of them the worktree's
  own copies.  The failure is not the spec being fussy — it is the
  spec doing its job, because `.npmignore` is a denylist with no
  `.claude` entry, so `npm pack --dry-run` lists **141 of 278
  files from inside a dead agent worktree**.  A release cut from
  this tree publishes another agent's abandoned branch.
- **F5 — the verification loop's shape, measured.**  Quiet twins on
  this machine: `typecheck` 0.2 s, `lint` 0.2 s, `build` 1.0 s,
  `test:js` **7.4 s**, `test:soak` 1.6 s, `test:throws` **31.5 s**,
  `test:modules` **46.9 s** — `test:node` ≈ **88 s**, of which the
  two audits and the `npm pack`/status-site tier are 89%.  Round
  101 fixed what a green run *prints*; nothing has yet named what
  an agent should run **while iterating**, so agents either run the
  8-second trio or the 88-second chain by guess.
- **F6 — tracked cruft with no owner.**  `d2.scratch.mjs`,
  `tmp/x.json` and `tests-examples/demo-todo-app.spec.js` are
  tracked at the root, referenced by nothing, and read to an agent
  as part of the project.
- **F7 — the instructions are organised by repo topic, not by
  task.**  An agent arrives knowing what it is about to do
  ("change an arrowhead", "add a public method", "add a
  benchmark") and has to reconstruct, from prose organised by
  directory, which commands and which cautions apply.  Every one
  of those routes exists in `AGENTS.md` today; none of them is
  addressable.

### 108.1 — `AGENTS.md` becomes an instruction sheet; the lessons become `docs/agents/`

The root file is rewritten to **≤ 16 KB (~4k tokens)** and holds
only what is true for every task: the repo's shape, the command
table, the hard invariants that a wrong guess breaks silently
(`.mts` on disk / `.mjs` in specifiers, oxlint-not-ESLint,
oxfmt-not-Prettier, `node:test`-not-Mocha, rolldown-not-Rollup, the
v3 boundary), and a **routing table keyed by task** — F7's fix:
*changing the renderer → these commands, read `docs/agents/rendering.md`*;
*adding a public member → these, read `docs/agents/documentation.md`*;
*adding a benchmark → these, read `docs/agents/benchmarking.md`*.

Everything else moves **verbatim** into `docs/agents/*.md`, split
by the area it warns about — nothing is deleted, and each note
keeps its round attribution:

- `docs/agents/testing.md` — the testing-notes tier: controls,
  goldens, parity, Playwright's frame driver and worker ratio, the
  soak/throw/leak rules, the "a spec's name is not evidence" rule.
- `docs/agents/benchmarking.md` — the measurement lessons: `__name`,
  the harness fingerprint, `--repeat 3`, `--jobs`, the rows that
  measured nothing, the v3-side `styleEnabled`/`layout` bias.
- `docs/agents/documentation.md` — the JSDoc gates, the stranded
  doc block, the audit-scope rule, `EXECUTIVE_SUMMARY.md`'s
  maintenance rule.
- `docs/agents/architecture.md` — the directory-by-directory map
  that `AGENTS.md`'s "Repository structure" section is today, minus
  the war stories that go to the three files above.
- `docs/agents/rendering.md` — WGSL minification, the debug
  harness, the load-error phases, the fixture/wire-format notes.

Both agents follow a relative link when told to; neither needs a
new mechanism.  The root file's job becomes *routing*, and its
budget is what keeps it doing that job.

**Gated, not hoped** — `test/modules/agent-docs.mjs`:

1. `AGENTS.md` is under the byte budget.  Without this the file
   grows back, which is exactly how it got here.
2. Every rooted path mentioned in `AGENTS.md` or any
   `docs/agents/*.md` **resolves on disk** — round 42's lesson
   (`existsSync`, allowing for the `.mjs`-specifier convention),
   applied to the agent docs for the first time.
3. Every `docs/agents/*.md` is linked from `AGENTS.md`, and every
   link from `AGENTS.md` into `docs/agents/` names a file that
   exists — an unlinked note is an invisible note.
4. Every `npm run` script named in the agent docs exists in
   `package.json`, and (the reverse) every verification script in
   `package.json` is named somewhere in them.

### 108.2 — `PLAN.md` splits into `plan/rounds/` plus a generated index

One file per round: `plan/rounds/NNN-slug.md`, carrying that
round's plan section and its landed section together — which is
also a small win in itself, since today a round's plan and its
record sit thousands of lines apart.  `PLAN.md` keeps the three
standing sections it already maintains rather than appends to
("Open calls for the maintainer", "Suggested sequencing", the
process rules), plus the generated index; it lands at a few
hundred lines and stays readable by an agent in one call.

- `scripts/plan-index.mjs` regenerates `plan/INDEX.md` and the
  index block inside `PLAN.md` from the round files' front matter
  (round number, date, title, status: planned / landed).
- `test/modules/plan-record.mjs` gates it: the index matches the
  files on disk, round numbers are unique and unbroken, every
  round file has a title and a status, and no round file is
  orphaned.
- Adding a round becomes *writing one small file* — which is what
  makes this an agent-performance item and not a filing exercise.

**The control is byte-identity.**  The split is behaviour-neutral
only if the text survives it: concatenating the standing sections
and every `plan/rounds/*` in round order must reproduce the
pre-split `PLAN.md` modulo the inserted headings and front matter,
and that comparison is run and recorded at implementation, not
asserted.  Round 42's rule — *a restructure is behaviour-neutral
only if you check every file, not every test* — is the reason.

### 108.3 — v3 is declared frozen, and quiet by default in search

- **`v3/AGENTS.md`**, ~15 lines, picked up automatically by both
  agents the moment they work in that subtree: this is Cytoscape.js
  v3, kept whole for the comparison benchmarks and the pixel-parity
  harness; **do not change it** unless the task says v3; it builds
  and tests as its own project (`cd v3 && npm install && npm test`);
  its documentation describes v3 and v4 deviates deliberately.
  The cheapest item in the round and probably the highest
  value-per-byte.
- A root **`.ignore`** listing `v3/` (and `status/`, `test-results/`)
  so ripgrep and `fd` skip it by default — F3's ~57% noise cut.
  The escape hatch is documented beside it in the routing table,
  because v3 *is* searched deliberately for parity questions:
  `rg --no-ignore -g 'v3/**' …`, and the existing
  "grep `v3/documentation/docmaker.json` for the v3 API" workflow
  in `AGENTS.md` is rewritten to carry the flag.
- **Measured after, not assumed**: the four probe terms are
  re-counted through a default `rg` invocation and the before/after
  written into the landed section.

### 108.4 — an agent's worktree cannot break the build or reach npm

F4 has three halves and all three are fixed:

- `.npmignore` gains `.claude` — with a **packaging spec case**
  asserting nothing under `.claude/` is packed.  Its control is the
  live one: this very round is being written from a worktree, so
  the case must fail on today's `.npmignore` and pass after.
- Every tool that **walks the tree** is audited for the same blind
  spot and excludes `.claude/worktrees` explicitly:
  `jsdoc-coverage.mjs`, `throw-coverage.mjs`, `docs-generate.mjs`,
  the status build, `packaging.mjs`, `quiet-scripts.mjs`.  A walker
  that finds a second copy of `src/` reports on the wrong tree, and
  the only reason this surfaced as a *test failure* rather than as
  a wrong audit number is that one spec happened to use an
  allowlist.
- The process rule joins the closing sweep in `AGENTS.md`:
  `git worktree list` is checked when a round closes, and a landed
  round's worktree is removed.  The round-90 worktree and its
  352 MB go with this item.

### 108.5 — the inner loop gets a name

`npm run -s verify` — typecheck + lint + `test:js`, **~8 s
measured** — declared in the routing table as *what to run while
iterating*, with `test:node:quiet` (~88 s) as the gate before
handing work back and `test:quiet` for anything broad.  No new
machinery: it is one `run-s` line naming what the fast tier
already is, and it replaces a guess every agent currently makes
separately.  `test:throws` (31.5 s) and `test:modules` (46.9 s)
stay out of it deliberately — they are gates, not a loop.

### 108.6 — the cruft goes

`d2.scratch.mjs`, `tmp/x.json` and `tests-examples/` are removed
(they are tracked, so removal is recoverable), and `.gitignore`
gains `/tmp` so the next scratch file does not become a tracked
one.

### Controls named at planning

- **The byte budget can fail** — add 10 KB of prose to `AGENTS.md`
  and watch `agent-docs.mjs` go red.
- **The path check can fail** — introduce one bad path in a moved
  note; it must be named, not merely counted.
- **The `.claude` pack exclusion can fail** — measured against the
  live worktree, before and after.
- **The plan split is byte-identical** — the concatenation
  comparison above, run and recorded.
- **The search-noise claim is re-measured**, not assumed, after
  `.ignore` lands.
- **No lesson is lost** — the moved text is compared against its
  pre-move source, not eyeballed; a note that quietly loses a
  paragraph in the move is the one failure mode this round could
  have that nothing else would catch.

### Decided at planning (maintainer, 2026-08-24)

- `AGENTS.md`: **lean root plus linked notes**, nothing deleted.
- `PLAN.md`: **split into `plan/rounds/` with a generated index**.
- v3: **all three** mitigations — the guard file, the documented
  search default, and the repo `.ignore`.
- Harness config: **portable only** — no committed
  `.claude/settings.json`, nothing either agent cannot read.

**Open:** whether the notes live at `docs/agents/` (assumed) or
beside the code they describe; whether `PLAN.md` keeps its name as
the entry point once it is an index (assumed yes — every document
in the repo points at it).
