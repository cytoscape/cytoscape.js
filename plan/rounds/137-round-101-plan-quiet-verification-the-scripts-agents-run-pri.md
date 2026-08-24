## Round 101 plan — quiet verification: the scripts agents run print only failures (raised by the maintainer 2026-08-20)

The ask: quiet variants of the verification scripts —
`npm run test:quiet` and friends — that agents run instead of the
loud ones, so a green suite does not spend thousands of lines of
context saying so.  Two constraints, set by the maintainer at
planning: **no dot reporters**, and the output of any run is
**only actual failures** — a green run prints nothing at all
where the tooling allows it, the exit code is the contract, and a
red run prints the failing tests and nothing else: no pass lines,
no suite headers, no progress marks, no tallies, no diagnostics.
Tooling-only; no `src/` changes.

What a green run costs today, measured 2026-08-20 (lines / bytes
of combined stdout+stderr, npm's banner included):

- `test:js` — **3,072 lines / 180 KB**: the default reporter
  writes a ✔ line for each of 2,245 passing tests plus every
  suite header, and none of it is information — a green run's
  entire content is "nothing failed".
- `test:modules` — 661 lines / 39 KB (same reporter, plus the
  build step it runs first).
- `test:soak` 44 lines, `test:throws` 9, `build` 11, `lint` 6,
  `typecheck` 4 — the audits and compilers are already terse;
  most of their residue is npm's banner and a success summary.

So `test:node` green is ~3,800 lines / ~226 KB, 98% of it the two
big `node:test` tiers.  The failure path was probed too (a
two-test file, one failing): the runner's end-of-run "Failed
tests" section carries the failing test's name, its location and
the assertion diff — everything a reader acts on is in that
section, so printing only it loses nothing.  Node's built-in
`dot` reporter was measured for scale (133 lines / 2.8 KB on the
same green `test:js`) and is ruled out by the first constraint:
dots are still noise, and silence is the success signal.

### 101.1 — the failures-only reporter

`test/quiet-reporter.mjs`, wired as
`--test-reporter=./test/quiet-reporter.mjs`: consumes the
runner's event stream, emits **zero bytes** while everything
passes, and on failure prints each failing test's block — name,
file, assertion message and diff — and nothing else.  Passing
tests, suite headers, `ℹ` diagnostics and the tally are all
dropped; red is recognisable by the exit code and by the presence
of any output at all.  One question the events API answers at
implementation: a test body's own `console.log` arrives as
`test:stdout`/`test:stderr` events, so the reporter can replay a
*failing* test's output inside its block while dropping the green
tests' — the loud run stays the tool for watching a suite think.

### 101.2 — the capture wrapper for tools with no quiet mode

`scripts/quiet-run.mjs`, invoked as `quiet-run -- <command …>`:
spawn the command,
capture both streams, exit with the child's code — on zero print
nothing, on nonzero replay the capture byte-for-byte.  The
uniform answer for tools that own their own output — rolldown's
bundle table, oxlint's summary, tsc (silent on success already;
its npm banner is not) — and for composing tiers.  Known cost,
accepted: a hung child shows nothing until it is killed; the
diagnosis for a hang is a rerun of the loud twin, and the wrapper
does not try to be a progress UI.

### 101.3 — the variants, the Playwright reporter, and the docs

- Every verification script gains a `:quiet` twin —
  `test:js:quiet`, `test:modules:quiet`, `test:soak:quiet`,
  `test:throws:quiet`, `lint:quiet`, `typecheck:quiet`,
  `build:quiet` — plus the composites `test:node:quiet`,
  `test:playwright:quiet` and `test:quiet`, built from the quiet
  pieces with the same structure as the loud ones
  (`test:modules:quiet` still builds first, and so on).
- **A quiet twin is the same command modulo the reporter flag or
  wrapper prefix — enforced, not hoped**:
  `test/modules/quiet-scripts.mjs` parses `package.json` and
  asserts each pair differs only in those tokens, because a twin
  that drifts (a quiet variant losing its build step, say) fails
  green in the worst way.
- Playwright: the same principle as 101.1, as a small custom
  reporter (`playwright-tests/quiet-reporter.js` — print failures
  as they land, nothing on green), since no built-in reporter is
  silent on green without also being silent on red.
- npm's banner (two lines per `npm run`) belongs to the caller;
  `npm run -s` drops it, and whether `-s` on the outer call
  silences the nested `run-s` children's banners too (loglevel
  should inherit through the environment) is measured at
  implementation and the answer written into `AGENTS.md`.
- CI stays loud, deliberately: its logs are the record, read
  after the fact, and a red CI run wants the full transcript.
- `AGENTS.md`'s development-flow list is rewritten to name the
  quiet twins as what agents run; the loud originals remain for
  humans watching progress, for debugging, and for CI.

### Controls named at planning

- **Green is zero bytes, asserted as zero** — the reporter spec
  runs a passing file and compares captured output to the empty
  string, not to "short".
- **Red names the failure** — run a deliberately failing file and
  assert the output carries the test's name and the assertion
  message.  The round's most important spec: a quiet reporter
  that swallows failures is strictly worse than the noise it
  replaced, and (the round-27 rule) it runs once with the
  reporter's failure branch broken to prove it can fail.
- **Exit codes survive both layers** — reporter and wrapper:
  green exits 0, red nonzero, and the wrapper's replayed output
  matches the unwrapped run's byte-for-byte.
- **The twins cannot drift** — the `quiet-scripts` spec above,
  controlled by desynchronising one pair and watching it fail.

**Open:** whether the interactive scripts (`test:js:debug` and
kin) are explicitly exempt (recommended: yes — quiet is for
verification, not debugging); whether the status build and the
benchmark runners join later (default no — agents run those *for*
their output).

