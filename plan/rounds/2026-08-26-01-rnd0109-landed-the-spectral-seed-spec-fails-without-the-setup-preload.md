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

**Landed 2026-08-26 — and the plan above was wrong about its own
observation, which is the finding.**  Both halves of the premise
failed measurement, and the mechanism turned out to be nameable
without finding the invocation at all.

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
`test/force-layout.mjs` are byte-identical to today's.  There is no
half-working invocation to instrument, so there was no
registration-order diff to take: the hypothesis was falsified rather
than tested.

**What 346.4557 is.**  The number the round-86 run recorded is not a
curled scatter *near* some bound — it is exactly what this fixture
produces with the spectral seed skipped.  Measured both paths on the
chain, same seed, same process:

| `init` | n0→n39 spread |
| --- | --: |
| `spectral` (default) | 3207.7853 |
| `scatter` | **346.4558** |

Round 86 recorded 346.4557.  So whatever that run was, the spectral
seed did not run in it — `spectralSeed` is pure and deterministic
(pivot choice, BFS order, a hash-seeded power iteration, the jitter),
takes no global state, and the layout has no wall-clock termination,
so nothing about *how the process was started* can reach it.  The
remaining candidates are all branch-local to the round-86 worktree,
and none of them is reproducible from what the record kept.

**So the spec was given the assertion that can say this.**  The
existing bound (`> 936`) says "not curled"; it cannot say *why*.  The
new sibling spec measures both paths in one process and asserts the
gap — the scatter path must land under the old bound, and spectral
must clear it by 4x — so a regression that quietly falls back to the
scatter seed fails **by name** instead of as a number near a
threshold.  Its control: `spectralSeed`'s call site stubbed out, both
specs red, and the failing value printed as `346.45575009003477` —
round 86's number to seven more digits than it recorded.

**The one real harness defect, fixed.**  A wrong invocation does not
half-work, but it does fail illegibly — `ReferenceError: describe is
not defined` names neither the shim nor the preload — and the tier
offered no way to run a single spec file, which is why the round-86
agent hand-rolled one. `npm run -s test:js:one -- test/<file>.mjs` is
the tier's own invocation with the glob left off; it is in
`AGENTS.md`'s command table and explained in
`docs/agents/testing.md`. The plan's other idea — a guard in the shim
that fails loudly when it is not preloaded — was dropped as
unbuildable in that form: the shim *is* the preload, so it cannot
observe a run that omits it.

**Non-goal held**: nothing about the force layout changed.  The
diff is one spec file, one npm script, and two documentation lines.
