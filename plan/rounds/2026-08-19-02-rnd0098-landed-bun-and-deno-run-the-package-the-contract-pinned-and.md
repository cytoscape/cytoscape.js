## Bun and Deno run the package: the contract pinned and smoked

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

### Landed (2026-08-28)

Landed as planned, both opens taken as recommended: the smoke loads
the **minified ESM** too (it is what CDN users run, and the cost was
one more import), and **`ci-bun`/`ci-deno` gate merges from day one**
(an observing job is a soft-skip with extra steps).

**98.1, as shipped.**  `test/modules/import-graph.mjs` gained the
clause its header always implied: the set of non-relative specifiers
under `src/` is empty — one clause forbidding `node:*`, `bun:*`,
`deno:*` and bare packages alike.  The scanner strips comments first
with a **string-aware character walk** rather than another regex (the
plan's care point: a regex stripper eats `'//'` inside a string and
any import after it on the line), and the specifier pattern also
matches bare `import '…'` and dynamic `import('…')` forms, so the
clause covers shapes v4 has none of today.  Both planned controls run
and behaved: a real `node:path` import added to `src/math.mts` failed
the clause naming the file; the same line inside a doc comment passed
clean — no `file:line` allowlist anywhere, and the stripper carries
its own inline control spec.

**98.2, as shipped.**  `test/runtimes/smoke.mjs`: one framework-free
file, plain asserts, run as `node smoke.mjs`, `bun smoke.mjs` and
`deno run --allow-read smoke.mjs`, exit code as the contract.  It
loads the ESM, minified-ESM and CJS bundles and runs 46 value-and-
ordering assertions per bundle: headless init with
`headlessWidth`/`headlessHeight` set; the definition-form load and
the wire round-trip with **every dictionary column checked
value-for-value** (the 46.5 lesson verbatim); a sheet with constants,
a linear scale mapper and a bypass read back as values; grid plus
five CPU-force ticks; `bfs` depths sync and `pageRank` async with
`executor: 'cpu'` (which pins the promise/microtask tier per
runtime); event dispatch order and arguments; `json()` and the
bypasses section export.  **The require-compat measurement the plan
asked for: Deno's holds** — 2.9.6 loads the CJS bundle through
`createRequire` — so CJS is asserted on all three runtimes, contract
rather than bonus.  One deviation from the plan's letter, recorded:
"zero imports beyond the bundle under test" became *two* — loading a
CJS bundle from an ESM file needs `node:module`'s `createRequire`
plus `node:url`'s `fileURLToPath`, both of which all three runtimes
provide — and the risk the plan named (the smoke silently becoming a
fourth test tier) is handled exactly as it suggested:
`test/modules/runtime-smoke.mjs` enumerates the import list, so a
third entry is a red build.  That spec also pins the scripts' shape
(`test:runtimes:node`/`:bun`/`:deno`, each `run-s build …` per the
2026-08-06 lesson, each with a registered quiet twin) and runs both
planned controls as specs on Node; the controls were additionally run
by hand on all three runtimes — a missing bundle path and the
dict-as-array degraded reader both exit 1 loudly everywhere, the
latter failing on `a.label: expected "alpha", got undefined`, the
46.5 no-labels graph by name.

**98.3, unspent.**  The smoke found **zero defects** on Bun 1.4.0 and
Deno 2.9.6 — all three bundles, all 46 assertions, both runtimes,
first run — which is what item 2 of the runtime-rounds note
predicted: the headless path already spoke web-platform, and the
budget existed in case it did not.  No runtime conditional was added
anywhere; the animation driver's capability check remains the only
one in the tree.

**98.4, as shipped.**  `ci-bun` and `ci-deno` in `tests.yml`, shaped
like `ci-node` (checkout, official setup action beside `setup-node`,
root `npm ci`, `npm run build`, the smoke under the runtime; no v3
install), each a two-entry matrix of **latest stable plus the pinned
floor** — Bun 1.4.0 and Deno 2.9.6, the versions measured green at
landing.  `engines` stays `node >= 24`; the support sentence lives in
`src/README.md`'s new "Runtimes" section until round 99.3 gives it
its documentation-site home.  Both jobs were reproduced before
landing per round 53's rule — a detached worktree, fresh `npm ci`,
`npm run build`, then the smoke under all three runtimes: green,
FRESH-REPRO clean.
