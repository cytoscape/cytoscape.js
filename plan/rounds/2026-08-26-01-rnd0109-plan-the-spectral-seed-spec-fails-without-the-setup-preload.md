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
