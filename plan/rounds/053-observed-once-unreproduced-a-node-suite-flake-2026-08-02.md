## Observed once, unreproduced — a Node-suite flake (2026-08-02)

Logged so the breadcrumb is not lost, not because it is understood.

During the round-27 docs verification a single `npm run test:js` run
failed one spec; every other run that day passed.  What the output
showed: a chai `deepStrictEqual` on an array of element ids containing
at least `'1'` … `'8'`.  What is known:

- **Not reproduced in 37 subsequent full-suite runs**, nor in 60 runs
  of `test/algorithms-clustering.mjs` alone.
- The obvious suspect was **ruled out**.  `fuzzyCMeans` is the only
  clustering spec that passes `testMode: true` *without*
  `testCentroids`, so it falls through to `Math.random()` centroid
  initialization (`algorithms/k-clustering.mts` — the deterministic
  branch needs both).  Its spec is even named "random init".  But
  5,000 direct trials of exactly that fixture and options produced
  **0 mismatches**: the data is separated enough that random init
  always converges to the same partition.
- So the id array probably came from a different spec, and the run
  order or a shared global (the suite runs files concurrently) is the
  more likely direction than any one algorithm.

If it recurs, capture the failing spec name — that is the missing
piece.  Nothing here is a reason to distrust the round-27 results:
the same suite passed 37/37 afterwards, and every round-27 claim is
additionally pinned by browser specs and live parity diffs.

**It recurred once during round 41's verification (2026-08-04), and the
name was lost again — this time avoidably.**  One `npm run test:js`
reported `fail 1`; the diagnostic re-ran the suite instead of preserving
the failing run's output, and the re-run passed, so the spec name went
with it.  That is the second time this flake has been seen and the second
time nothing was learned from it, which makes the *method* the finding:
when a suite fails once, **keep that run's output** before doing anything
else.  A hunt of 20 consecutive full runs immediately afterwards
(captured to files, precisely so a hit would be readable) produced 0
failures, and ~28 clean runs surround the single failure.

The timing invites an obvious suspicion — it landed in the round that
replaced the emitter — and **it is not ruled out**, because without the
spec name nothing can be.  What can be said: the emitter swap was already
in the tree, 20 consecutive runs of that same tree passed, and the
phenomenon predates the swap by two days and one identical symptom
(`fail 1`, unreproducible).  That is evidence for "same flake", not
proof.  If a third sighting comes, the name settles it either way — which
is the whole reason to keep the output.
