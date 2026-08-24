## Round 101 — quiet verification: green prints nothing, red prints only failures (2026-08-24)

The plan above, implemented as specified, with one deviation the
events API forced (101.1) and one measurement the plan left open
(101.3), both recorded here.

### 101.1 — the failures-only reporter (2026-08-24)

`test/quiet-reporter.mjs`, wired as `--test-reporter=`: zero bytes
while everything passes, and on failure one block per failing test —
suite path, `file:line:column`, the unwrapped error (the assertion
message and diff), and the file's captured output.  Suite echoes are
dropped by failure type (`subtestsFailed`, `cancelledByParent`), so a
failing test inside a `describe` prints one block, not two.

**The deviation: the replayed output is the failing *file's*, not the
failing test's.**  The plan hoped `test:stdout`/`test:stderr` events
would let the reporter replay a failing test's own output while
dropping the green tests' — measured at implementation, they do not.
An event dump over the red fixture shows both tests' writes arriving
*before the first `test:pass`* (the child's stdout pipe is decoupled
from its result stream), so clearing the buffer on pass drops a
failing test's own noise, and per-test attribution does not exist at
this API.  Whole-file replay never loses failing output; the price —
a green neighbour's noise rides along — is paid only on red, and the
spec asserts the behaviour so a future "improvement" that quietly
reintroduces pass-clearing fails.

One trap worth recording for any spec that spawns the runner: this
spec itself runs as a `node:test` child, and a spawned `node --test`
that inherits **`NODE_TEST_CONTEXT`** behaves as another child —
serialised events, no reporter, exit 0 with empty stdout, which reads
exactly like the reporter being broken.  The spec strips the variable
from the fixture runs' env.

### 101.2 — the capture wrapper (2026-08-24)

`scripts/quiet-run.mjs`, as planned: spawn, capture both streams,
exit with the child's code; on zero print nothing, on nonzero replay
byte-for-byte on the right streams.  Byte-for-byte is asserted by
comparison against an unwrapped run of the same command.  Also
pinned: `--` is accepted, no command is usage + exit 2, a missing
command is exit 127 naming the command.

### 101.3 — the twins, the Playwright reporter, the drift gate (2026-08-24)

Fifteen `:quiet` scripts: `build`, `lint`, `typecheck`, `test:js`,
`test:modules` (+`:run`), `test:soak`, `test:throws`,
`test:playwright` (+`:install`, `:build`, `:build:v3`, `:run`),
`test:node`, `test`.  Reporter tiers differ from their loud twins by
the one `--test-reporter=` / `--reporter=` token, tool tiers by the
`node scripts/quiet-run.mjs ` prefix, composites by `:quiet` on each
step — and `test/modules/quiet-scripts.mjs` normalises those tokens
away and asserts equality, enumerating in both directions (every
registered pair exists; every `*:quiet` in `package.json` is
registered), so a drifted twin or a stray one fails the build.

The Playwright reporter is `playwright-tests/quiet-reporter.mjs` —
`.mjs`, not the plan's `.js`, because the Node spec that drives it
imports it through tsx, which treats a `.js` in this no-`"type"`
package as CJS; Playwright loads `.mjs` reporters fine.  It buffers
each test's stdio by test id (Playwright *does* attribute, unlike
`node:test`), prints a failing test's block on its final attempt
only, always prints worker-level `onError`, and takes an injectable
write sink so its spec never touches the real stdout.  Driven
directly with the shapes Playwright hands a reporter, in the Node
tier — spinning a real browser suite up to red is what it saves.

**The npm-banner question is answered: `npm run -s` silences the
nested banners too.**  Measured with a `run-s` composite: loud is 89
bytes of banner; `npm run -s` is zero bytes end to end, because
loglevel inherits through the environment into every nested
`npm run` the `run-s` children spawn.  So the agent-facing invocation
is `npm run -s <script>:quiet`, and `AGENTS.md`'s development flow
now says so.

The reporter file lives in `test/`, so the `test:js` glob (and its
`test:js:debug` and `scripts/throw-coverage.mjs` copies) grew a
third exclusion: `!(types-*|node-test-setup|quiet-reporter)`.

### 101.4 — measured, and the controls (2026-08-24)

The headline numbers, same measure as planning (combined
stdout+stderr):

| green run | before | after (`npm run -s …:quiet`) |
|---|---:|---:|
| `test:js` | 3,072 lines / 180 KB | **0 bytes** |
| `test:node` | ~3,800 lines / ~226 KB | **0 bytes** |

Zero is asserted, not observed: the reporter spec compares a green
run's captured streams to the empty string, and the full
`test:node:quiet` was run end to end and measured at 0 bytes on both
streams, exit 0.  The *first* end-to-end run was red, and usefully so:
it printed one block — 920 bytes naming `status-site.mjs`'s
planned-paths gate, which had gone red because this round's own files
began resolving (the exact lifecycle that gate enforces) — and
nothing else.  The failure mode the round exists for, demonstrated on
its own change.

The four controls named at planning, each run broken and restored:

- reporter's failure branch deleted (the `yield` dropped) — 4 red-run
  specs fail, the green-run specs stay green, which is the point;
- wrapper's replay branch disabled — the byte-for-byte spec fails;
- one twin desynchronised (`test:modules:quiet` loses its build
  step) — the drift gate fails on that pair;
- Playwright reporter's failure branch short-circuited — 3 of its 5
  specs fail.

The open questions resolved as recommended: the interactive scripts
(`test:js:debug`, `test:modules:debug`) have no quiet twins — quiet
is for verification, not debugging; the status build and the
benchmark runners stay loud — agents run those *for* their output.
CI stays loud, as planned.

