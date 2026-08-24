## Round 98 plan — Bun and Deno run the package: the contract pinned and smoked (raised by the maintainer 2026-08-19)

### 98.1 — the runtime-clean invariant, pinned

`test/modules/import-graph.mjs` gains the assertion its header
already implies: **the set of non-relative specifiers under `src/`
is empty** — which forbids `node:*`, `bun:*`, `deno:*` and bare
package imports in one clause, and turns "runs on any
standards-shaped runtime" from a fortunate fact into a gated one.
Care point, named before it bites: the scanner is regex-over-text,
and `src/layout/contract.mts:8` shows a bare specifier inside a
doc-comment example *today* — so the scan must strip comments (or
join-then-classify, `signatureOf`-style) rather than grow a
`file:line` allowlist that round 37.1 taught us goes stale by
insertion.  **Control:** add a `node:path` import to one module
and watch the new clause fail; re-run with the import inside a doc
comment and watch it *not* fail.

### 98.2 — the cross-runtime smoke, one file, three runtimes

`test/runtimes/smoke.mjs`: plain asserts, **zero test framework,
zero imports beyond the bundle under test** — the same file runs
as `node smoke.mjs`, `bun smoke.mjs`, and
`deno run --allow-read smoke.mjs`, and the exit code is the
contract.  It loads the **built bundles** (ESM on all three; CJS
on Node and Bun, and on Deno if its require-compat holds — a
measurement recorded either way), which makes this tier the
bundle-level coverage the testing notes keep saying barely exists.
What it asserts, drawn from the tiers that must work headless:

- factory + headless init with `headlessWidth`/`headlessHeight`
  set (the standing rule — a smoke that inherits 800×600 by luck
  is testing a different graph);
- definition-form load and the wire round-trip, asserting **each
  dictionary column still carries values** after the trip — the
  round-46.5 lesson, verbatim, because a compat layer that hands
  back a subtly wrong `TextDecoder` produces exactly that
  plausible-looking graph with no labels;
- style: a sheet with constants, scale mappers and a bypass
  compiles and reads back expected *values* (assert values, never
  completion);
- layouts: grid + a few CPU-force ticks;
- algorithms: one sync, one async through the promise tier with
  `executor: 'cpu'` — which also pins microtask/timer semantics
  (`dirty.mts`'s `queueMicrotask` flush ordering) on each runtime;
- events, `json()`, and the bypasses section export.

Wire it as `test:runtimes:node` / `test:runtimes:bun` /
`test:runtimes:deno` npm scripts, each `run-s build …` so a stale
bundle cannot pass for a fresh one (the 2026-08-06 lesson).
**Control:** point the smoke at a bundle path that does not exist
and at a deliberately degraded reader (the 46.5 dict-as-array
control) — both must fail on all three runtimes, loudly, never a
soft-skip (the parity-suite rule: a smoke that quietly stops
running is worth less than one that is absent).

### 98.3 — fix what the smoke finds, budgeted

Expected small — item 2 above is why — but the budget is real and
each fix lands with its assertion added to the smoke, so the fix
is pinned where it was found.  If a fix wants a runtime
conditional, the shape is the animation driver's existing one
(feature-test the global, never `typeof Deno`-style runtime
sniffing): capability checks age well, identity checks are the
UA-string mistake wearing a new coat.

### 98.4 — CI: `ci-bun` and `ci-deno`

Two new jobs in `tests.yml`, shaped like `ci-node`: checkout,
official setup action, root `npm ci`, `npm run build`, run the
smoke.  No v3 install (the Node-tier invariant extends to these
jobs).  Version policy: **latest stable plus a pinned floor**,
the floor recorded where the docs state support (98.4 writes the
sentence, 99.3 gives it a home) — `engines` cannot express Bun or
Deno and stays `node >= 24`.  Before pushing, reproduce both jobs
in a detached worktree with a fresh install — round 53's rule,
and both of round 53's chronic failures were exactly
fresh-checkout artifacts.

### Risks named at planning

- **A compat layer can pass a smoke while differing subtly** —
  which is why every smoke assertion is on values and ordering,
  not on "it didn't throw".
- **Bun and Deno move fast.**  A runtime bump that breaks the job
  is handled like a browser bump breaking a golden: read the
  failure, then move the pin — never widen the assertion.
- The smoke file must stay import-free and framework-free or it
  silently becomes a fourth test tier with its own compat needs;
  a `test/modules/` spec can lint that (its import list is
  enumerable).

**Open:** whether the smoke also loads the *minified* bundles
(recommended: yes for ESM-min — it is what CDN users run, and the
cost is one more import); whether `ci-bun`/`ci-deno` gate merges
from day one or observe for a week first (recommended: gate —
an observing job is a soft-skip with extra steps).

