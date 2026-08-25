## `@param` completeness

Round 31 closed the `@throws` half of round 26's contract sentence
("what it takes, what it returns, what it throws").  This round closes
**what it takes**, and stops there deliberately.

**Why `@param` and not `@returns`.**  Round 26 recorded docmaker's
per-function shape: `{ name, descr, formats: [ { descr, args: [ { name,
descr } ] } ] }`.  Arguments have a **description field the generator
emits**; there is no return field at all.  So a missing `@param` is a
hole in the release documentation v4 will ship, while a missing
`@returns` is editor hover text only.  That is a boundary in the
already-decided design rather than an arbitrary cut, which is what
makes this round no-call work.

**Measured** (public tier — the nine `PUBLIC_API` files, overload-aware
so an implementation signature closing a run of documented overloads is
not counted): **221 public members take parameters; 143 document them
and 78 do not.**  The convention is established practice at 65%, not an
open question — round 26 simply stopped at doc-comment *presence*.
By file: `collection.mts` 28, `animation.mts` 18, `core.mts` 13,
`viewport.mts` 8, `style.mts` 8, `layout/contract.mts` 3.

**The `@returns` tail is measured and logged, not built**: **63 of 276**
value-returning public members lack the tag.  It is worth doing, and it
is worth doing when someone is generating the docs and can see what
reads badly — nothing downstream consumes it today.

*(This figure was first published as "133 of 348" — from the same
throwaway scan that misreported the `@throws` count in the round-31
plan, counting `if(`/`for(` as members and not skipping the
implementation signature that closes a run of overloads.  Re-measured
2026-08-03 with the overload-aware scanner the shipped audits use.
Third time that scan has produced a wrong number in a plan: use
`auditParamTags`/`auditThrowTags` as the template, not a fresh
regex.)*

**Pass split** (docs in-commit; one commit per file group):

- [x] **32.1 `core.mts` + `viewport.mts`** (2026-08-03) — 21 members;
  143 → 164 of 221.  These are generator output, so each says what the
  argument *means*: `animate()`'s opts names the override order and the
  panBy/pan throw, `setZoom`'s option form is the
  keep-this-point-stationary case, `stop()`'s `jumpToEnd` is the
  difference between applying the targets and freezing where the tween
  reached.
- [x] **32.2 `collection.mts`** (2026-08-03) — 28 members; 164 → 192.
  Two wording calls worth recording.  The thirteen compound and DAG
  traversals take the same optional `criterion`, so they share one
  sentence rather than thirteen paraphrases — a generator emits them
  side by side and they should read as one family.  And the overloaded
  readers describe the *forms* rather than naming a type: `data()`'s
  args line lists its four spellings, `relativePosition`'s `dim` covers
  read-pair / read-axis / write-pair, and `style()`'s `value` is
  documented as never valid, since it exists only so the setter form
  throws instead of silently ignoring it.
- [x] **32.3 `animation.mts` + `style.mts` + `layout/contract.mts`**
  (2026-08-03) — 29 members; **221/221**.  The clock parameters are
  where a description earns its line: `now` is the *shared* clock in
  every one of them, which is what makes the CPU settle and the GPU
  evaluation agree, so each says so instead of "the current time".
  `setPositions` documents the packing (`xy[i*2]` lands on `slots[i]`)
  — the one thing a layout author must get right — and `refreshMapped`
  says `keys` is the gate on what re-evaluates, not merely a record of
  what was written.
- [x] **32.4 The audit + gate, and the closing sweep** (2026-08-03) —
  `auditParamTags()` joins `auditThrowTags()` in
  `scripts/jsdoc-coverage.mjs`, overload-aware through the same
  regexes, public tier only, printed under the coverage report and
  listed by `--verbose`.  Gated in `test/jsdoc-coverage.mjs` under
  31.2's reasoning: documentation completeness is already a gated
  concern here, so this maintains an existing gate.
  Controls: a `@param` line deleted → 1 failing; an undocumented
  parameterized member added to `viewport.mts` → 3 failing; the audit
  short-circuited so it checks nothing → 1 failing (the
  non-trivial-count guard).

  Docs: the README's JSDoc section carries the rule and the reason the
  boundary sits where it does, and its header carries round 32.
  Verification: **2487** Node tests (the gate's own two specs are the
  round's only additions — 32.1–32.3 changed comments alone), 68 module
  tests, typecheck, lint, JSDoc coverage 100%, `@throws` 16/16,
  `@param` 221/221, and the regenerated `dist/cytoscape.d.ts`
  (comments only in `src/`, so the browser suites are unaffected).
  *(First written as 2485: the verification run's tally was read from a
  grep that missed the line.  Caught by the docs sweep below, which is
  the argument for re-running a tool rather than re-reading a record.)*
  **Round 32 is complete.**
