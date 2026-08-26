## The spectral-seed spec fails without the setup preload

Found incidentally by round 86, which ran `test/force-layout.mjs` by
itself while chasing an unrelated red and got a deterministic failure
the full tier never shows.  Everything below was verified on
2026-08-26 on the round-86 branch, and the failure reproduces at the
branch base (`73873cd0`), so it predates that round's changes.

**The observation, exactly.**  The tier runs every spec with the shim
preloaded:

```
node --import tsx --import ./test/node-test-setup.mjs --test test/…
```

Run that way, `test/force-layout.mjs` passes 13/13 — standalone or in
the tier.  Run *without* the preload —

```
node --import tsx --test test/force-layout.mjs
```

— the file still loads (it imports `./node-test-setup.mjs` itself) and
twelve specs still pass, but **"uncurls a chain: the spectral seed
reaches what refinement cannot (59.4)" fails deterministically**: the
n0→n39 spread measures 346.4557 against the >936 bound (a straight
39-link chain at ideal length 60 spans ~2340; 346 is a curled
scatter).  The same wrong number every run, so this is not noise — the
layout genuinely runs differently under the two invocations.

**Why this deserves a round rather than a shrug.**  A spec whose
result depends on *how the harness was invoked* is measuring something
about the harness, and both possible resolutions are cheap once the
mechanism is known:

1. **Find the mechanism.**  The import-order difference is the only
   known variable: preloaded, the shim initializes before the test
   runner begins; unpreloaded, it initializes during the file's own
   evaluation.  What that changes for exactly one spec — plausibly
   `beforeEach` registration timing altering which instance/seed state
   the spectral test inherits from its siblings — is the question.
   Instrument the shim to log registration order under both
   invocations and diff.
2. **Then either fix the sensitivity or refuse the invocation.**  If
   the spectral spec depends on sibling state, that is a spec bug to
   fix (it should seed everything it needs).  Independently, the shim
   should probably **fail loudly when it is imported without the
   preload** rather than half-working — a one-line guard
   (`process.execArgv` or an env sentinel), so the wrong invocation
   becomes an error message instead of a wrong measurement.  That is
   this repo's standing policy (fail loudly) applied to its own
   harness.

**First measurement**: the shim's registration-order diff between the
two invocations, run on this one file — it either names the mechanism
in one sitting or falsifies the import-order hypothesis and the hunt
widens to what else differs (module cache order through tsx, test
runner concurrency defaults).

**Non-goals.**  Nothing about the force layout's quality: the spectral
seed itself is round 59.4's, verified there; under the documented
invocation it still reaches what refinement cannot.

### Landed

**Landed 2026-08-26.**  The plan's premise was wrong in its first
sentence and right about the spec: there is no invocation-shape
sensitivity, and there *is* an intermittent failure, which this round
measured, named, and left instrumented rather than fixed.

**The stated repro does not run.**  The plan says the file "still
loads (it imports `./node-test-setup.mjs` itself)" without the
preload.  It does not, and it never did: no spec under `test/` imports
the shim (`test/modules/worker-renderer.mjs` is the only file in the
tree that does), so

```
node --import tsx --test test/force-layout.mjs
```

dies at `describe is not defined` before a single spec runs — verified
at HEAD and at the round-86 base `73873cd0`, where `src/layout/` and
`test/force-layout.mjs` are byte-identical to today's.  So the
import-order hypothesis had nothing to instrument: it was falsified,
not tested.  Round 108 had in fact already recorded the true shape and
this round's plan did not find it — the spec failed **2 of 4 full
`test:node` runs** on 2026-08-24 and passed 3 of 3 run alone, "always
with the identical value".  A round reading only round 86's note
inherited round 86's diagnosis.

**What 346.4557 is.**  Not a curled scatter *near* some bound — it is
exactly what this fixture produces with the spectral seed skipped.
Both paths, same seed, same process:

| `init` | n0→n39 spread |
| --- | --: |
| `spectral` (default) | 3207.7853 |
| `scatter` | **346.45575009003477** |

Round 86 recorded 346.4557 and round 108 recorded 346.456.  So in
every failing run the spectral seed contributed nothing — which is a
much narrower statement than "the layout runs differently", and it
rules out the whole family of explanations the plan was reaching for:
`spectralSeed` is pure and deterministic (pivot choice, BFS order, a
hash-seeded power iteration, the jitter), it reads no global state,
there is no `Math.random` in `src/layout/` outside the `random`
layout, and neither the seed nor the sim has any wall-clock or
iteration-budget term that a busy machine could move.

**Reproduced once here, and not with a probe attached.**  One failure
in 3 uninstrumented `test:js` runs (the same value to 17 digits);
then **0 in 20** further runs — 12 with a probe inside the seeding
branch, 6 with a failure-only probe carrying the layout's inputs, 2
under 16 concurrent CPU hogs.  Every probed run recorded identical
inputs (`meanL` 60, one component of 40, 39 edges, byte-identical
seeded positions) and a spectral embedding that worked.  Instrumenting
the branch appears to perturb whatever the failure needs, which is
itself evidence: the inputs are not what varies.

**So the round left the diagnosis in the spec instead of a fix.**
Three rounds have now read the same bare assertion failure —
"346.4557 is not above 936" — and each guessed a different mechanism
from it.  The spec now re-measures the scatter path *in the failing
process* and says which of the two possible failures happened:

```
chain spread 346.45575009003477; the scatter path measures
346.45575009003477 in this same process, so the spectral seed did not run
```

A sibling spec asserts the same discrimination on every run (scatter
under the old bound, spectral clearing it by 4x), so a regression that
falls back to the scatter seed fails by name rather than as a number
near a threshold.  Control for both: `spectralSeed`'s call site
stubbed out — both red, printing the message above.

**The residual, logged as ledger item 52**: the flake itself, with the
next measurement named (catch one failing run with a probe that is
cheap enough not to move it, and compare the *seeded* positions, since
the inputs are now known to be constant).

**The one real harness defect, fixed.**  A wrong invocation does not
half-work, but it does fail illegibly — `ReferenceError: describe is
not defined` names neither the shim nor the preload — and the tier
offered no way to run a single spec file, which is why the round-86
agent hand-rolled one.  `npm run -s test:js:one -- test/<file>.mjs` is
the tier's own invocation with the glob left off; it is in
`AGENTS.md`'s command table and explained in
`docs/agents/testing.md`.  The plan's other idea — a guard in the shim
that fails loudly when it is not preloaded — was dropped as
unbuildable in that form: the shim *is* the preload, so it cannot
observe a run that omits it.

**Non-goal held**: `src/` is untouched.  The diff is one spec file,
one npm script, and two documentation lines.
